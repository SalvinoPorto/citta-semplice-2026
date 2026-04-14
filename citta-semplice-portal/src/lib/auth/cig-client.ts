/**
 * CIG SSO Client - TypeScript port of Rgls.Cig.CIGClient (.NET)
 *
 * Implements the PS2S (Portal-to-SSO) protocol used by the
 * Comune di Catania single sign-on service.
 */

import { createHash } from 'crypto';

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const SECRET_KEY = process.env.CIG_SECRET_KEY ?? 'CHIAVE';
const DEFAULT_COMPONENTE = 'DEF';
const WINDOW_MINUTES = 30;

// --------------------------------------------------------------------------
// CBuf helpers (mirrors Rgls.Cig.Utility.CBuf)
// Each char is treated as a raw byte (lower 8 bits only).
// --------------------------------------------------------------------------

function toByteBuffer(str: string): Buffer {
  const buf = Buffer.allocUnsafe(str.length);
  for (let i = 0; i < str.length; i++) {
    buf[i] = str.charCodeAt(i) & 0xff;
  }
  return buf;
}

function fromByteBuffer(buf: Buffer): string {
  let s = '';
  for (let i = 0; i < buf.length; i++) {
    s += String.fromCharCode(buf[i]);
  }
  return s;
}

function encodeBase64(str: string): string {
  return toByteBuffer(str).toString('base64');
}

function decodeBase64(str: string): string {
  return fromByteBuffer(Buffer.from(str, 'base64'));
}

function toBase16String(buf: Buffer): string {
  let s = '';
  for (let i = 0; i < buf.length; i++) {
    const h = buf[i].toString(16);
    s += h.length === 1 ? '0' + h : h;
  }
  return s.toUpperCase();
}

// --------------------------------------------------------------------------
// RC4 cipher (mirrors Rgls.Cig.Utility.RC4)
// --------------------------------------------------------------------------

class RC4 {
  private s: number[] = new Array(256);

  initialize(key: string): void {
    const keyBytes = toByteBuffer(key);
    const k: number[] = new Array(256);
    let ki = 0;
    for (let i = 0; i < 256; i++) {
      if (ki >= key.length) ki = 0;
      k[i] = keyBytes[ki++];
    }
    for (let i = 0; i < 256; i++) this.s[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + this.s[i] + k[i]) % 256;
      [this.s[i], this.s[j]] = [this.s[j], this.s[i]];
    }
  }

  process(input: string): string {
    let i = 0,
      j = 0,
      out = '';
    for (let n = 0; n < input.length; n++) {
      i = (i + 1) % 256;
      j = (j + this.s[i]) % 256;
      [this.s[i], this.s[j]] = [this.s[j], this.s[i]];
      const k = this.s[(this.s[i] + this.s[j]) % 256];
      out += String.fromCharCode(input.charCodeAt(n) ^ k);
    }
    return out;
  }

  static randomString(len = 10): string {
    let s = '';
    for (let i = 0; i < len; i++) {
      s += String.fromCharCode(Math.floor(Math.random() * 256));
    }
    return s;
  }
}

// --------------------------------------------------------------------------
// TrasfObj helpers (mirrors Rgls.Cig.SecretCode.TrasfObj)
// Internal password hardcoded as "Regulus" (bytes 82,101,103,117,108,117,115)
// --------------------------------------------------------------------------

const TRASFOBJ_PWD = String.fromCharCode(82, 101, 103, 117, 108, 117, 115); // "Regulus"

function trasfCripta(plaintext: string): string {
  const rc4 = new RC4();
  const salt = RC4.randomString(10);
  rc4.initialize(TRASFOBJ_PWD + salt);
  const encrypted = rc4.process(plaintext);
  return toByteBuffer(salt + encrypted).toString('base64');
}

function trasfDecripta(ciphertext: string): string {
  const rc4 = new RC4();
  const raw = fromByteBuffer(Buffer.from(ciphertext, 'base64'));
  const salt = raw.substring(0, 10);
  const encrypted = raw.substring(10);
  rc4.initialize(TRASFOBJ_PWD + salt);
  return rc4.process(encrypted);
}

// Encrypt the secret once at module load (mirrors SCBase constructor with PS2S_KT_CLEAR)
const ENCRYPTED_SECRET = trasfCripta(SECRET_KEY);

// --------------------------------------------------------------------------
// Time tag helpers (mirrors SCBase / TrasfObj)
// Format: yyyyMMddHHmm
// --------------------------------------------------------------------------

function tagOrario(dt: Date): string {
  const y = dt.getFullYear().toString().padStart(4, '0');
  const mo = (dt.getMonth() + 1).toString().padStart(2, '0');
  const d = dt.getDate().toString().padStart(2, '0');
  const h = dt.getHours().toString().padStart(2, '0');
  const mi = dt.getMinutes().toString().padStart(2, '0');
  return `${y}${mo}${d}${h}${mi}`;
}

// Returns ddMMyyyy from yyyyMMddHHmm tag
function tagOrarioShort(sTag: string): string {
  if (sTag.length !== 12) return tagOrario(new Date());
  const day = sTag.substring(6, 8);
  const month = sTag.substring(4, 6);
  const year = sTag.substring(0, 4);
  return day + month + year;
}

// --------------------------------------------------------------------------
// Hash (mirrors SCBase.CreaBufferHash)
// MD5( tag + data + decryptedSecret + shortTag )  →  HEX uppercase
// --------------------------------------------------------------------------

function creaBufferHash(data: string, tag: string): string {
  const shortTag = tagOrarioShort(tag);
  const secret = trasfDecripta(ENCRYPTED_SECRET); // returns SECRET_KEY ("CHIAVE")
  const input = toByteBuffer(tag + data + secret + shortTag);
  const md5 = createHash('md5').update(input).digest();
  return toBase16String(md5);
}

// --------------------------------------------------------------------------
// XML helper (mirrors SCBase.MySelectSingleNode — string-based, no DOM)
// --------------------------------------------------------------------------

function extractXmlTag(xml: string, tag: string): string {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = xml.indexOf(open);
  const end = xml.indexOf(close);
  if (start >= 0 && start < end) {
    return xml.substring(start + open.length, end);
  }
  return '';
}

// --------------------------------------------------------------------------
// PS2S result codes (mirrors SCBase constants)
// --------------------------------------------------------------------------

export const PS2S = {
  OK: 0,
  HASHERROR: -1,
  HASHNOTFOUND: -2,
  COMPERROR: -3,
  TIMEELAPSED: -4,
  DATAERROR: -5,
  XMLERROR: -6,
  DATEERROR: -7,
  CREATEHASHERROR: -8,
  HTTPCONNECTION: -9,
};

// --------------------------------------------------------------------------
// CigClient
// --------------------------------------------------------------------------

export class CigClient {
  private serverUrl = '';
  private _netBuffer = '';
  private _dataBuffer = '';

  setServerUrl(url: string): void {
    this.serverUrl = url;
  }

  get netBuffer(): string {
    return this._netBuffer;
  }

  get dataBuffer(): string {
    return this._dataBuffer;
  }

  /**
   * Pack a data string into a signed Buffer XML envelope (PS2S_Data2NetBuffer).
   * Protocol v2: data is base64-encoded; no %26 substitution.
   */
  private data2NetBuffer(data: string, comp: string, dt: Date, proto = 2): number {
    const data1 = proto === 2 ? encodeBase64(data) : data;
    const tag = tagOrario(dt);
    const hash = creaBufferHash(data1, tag);
    if (!hash) return PS2S.CREATEHASHERROR;

    let xml = '<Buffer>';
    if (proto === 2) xml += '<ProtocolVersion>2</ProtocolVersion>';
    xml += `<TagOrario>${tag}</TagOrario>`;
    xml += `<CodicePortale>${comp}</CodicePortale>`;
    xml += `<BufferDati>${data1}</BufferDati>`;
    xml += `<Hash>${hash}</Hash>`;
    xml += '</Buffer>';

    this._netBuffer = proto !== 2 ? xml.replace(/&/g, '%26') : xml;
    return PS2S.OK;
  }

  /**
   * Verify and unpack a signed Buffer XML envelope (PS2S_Net2DataBuffer).
   */
  private net2DataBuffer(netBuffer: string, _comp: string, windowMin: number): number {
    const versionStr = extractXmlTag(netBuffer, 'ProtocolVersion');
    const proto = versionStr === '' ? 1 : parseInt(versionStr, 10);

    // Protocol v1 uses %26 in place of & inside the XML
    const xml = proto !== 1 ? netBuffer : netBuffer.replace(/%26/g, '&');

    const sTag = extractXmlTag(xml, 'TagOrario');
    if (!sTag) return PS2S.XMLERROR;

    const bufferData = extractXmlTag(xml, 'BufferDati');
    if (!bufferData) return PS2S.XMLERROR;

    // Time-window check (anti-replay)
    const year = parseInt(sTag.substring(0, 4), 10);
    const month = parseInt(sTag.substring(4, 6), 10) - 1;
    const day = parseInt(sTag.substring(6, 8), 10);
    const hour = parseInt(sTag.substring(8, 10), 10);
    const minute = parseInt(sTag.substring(10, 12), 10);
    const tagDate = new Date(year, month, day, hour, minute, 0);
    const diffMin = Math.abs((Date.now() - tagDate.getTime()) / 60_000);
    if (diffMin > windowMin) return PS2S.DATEERROR;

    // Hash verification
    const expectedHash = creaBufferHash(bufferData, sTag);
    if (!expectedHash) return PS2S.CREATEHASHERROR;

    const receivedHash = extractXmlTag(xml, 'Hash');
    if (!receivedHash) return PS2S.HASHNOTFOUND;

    if (expectedHash.toLowerCase() !== receivedHash.toLowerCase()) return PS2S.HASHERROR;

    this._dataBuffer = proto !== 2 ? bufferData : decodeBase64(bufferData);
    return PS2S.OK;
  }

  private async doPost(url: string, body: string): Promise<string> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      // Disable certificate validation only in dev when needed
      // In production the SSO endpoint has a valid cert
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return (await res.text()).trim();
  }

  /**
   * PS2S_CC_Request2RID:
   * Packs the auth request → sends to Request2RID.jsp → packs the response.
   * After success, this.netBuffer contains the buffer to send to AutRequest.do.
   */
  async request2RID(requestXml: string, comp = DEFAULT_COMPONENTE, dt = new Date()): Promise<number> {
    let ret = this.data2NetBuffer(requestXml, comp, dt, 2);
    if (ret !== PS2S.OK) return ret;

    let response: string;
    try {
      response = await this.doPost(this.serverUrl, 'buffer=' + encodeURIComponent(this._netBuffer));
    } catch {
      return PS2S.HTTPCONNECTION;
    }

    ret = this.data2NetBuffer(response, comp, dt, 2);
    return ret;
  }

  /**
   * PS2S_CC_TID2Ticket:
   * Packs the TID → sends to TID2Ticket.jsp → verifies & unpacks user XML.
   * After success, this.dataBuffer contains the user XML (<Attivazione>…).
   */
  async tid2Ticket(
    tidBuffer: string,
    comp = DEFAULT_COMPONENTE,
    dt = new Date(),
    windowMin = WINDOW_MINUTES,
  ): Promise<number> {
    let ret = this.data2NetBuffer(tidBuffer, comp, dt, 2);
    if (ret !== PS2S.OK) return ret;

    let response: string;
    try {
      // Note: no encodeURIComponent here (matches C# pPS2S_Client_TID2Ticket)
      response = await this.doPost(this.serverUrl, 'buffer=' + this._netBuffer);
    } catch {
      return PS2S.HTTPCONNECTION;
    }

    ret = this.net2DataBuffer(response, comp, windowMin);
    return ret;
  }
}

// --------------------------------------------------------------------------
// Auth request XML builder (mirrors AuthRequest.toXML())
// --------------------------------------------------------------------------

export function buildAuthRequestXml(
  urlReturn: string,
  urlErrore: string,
  styleSheet = '',
  urlLogo = '',
): string {
  return [
    '<AuthRequest>',
    '<PortaleID>WEB</PortaleID>',
    '<KioskMode>0</KioskMode>',
    `<URLDiRitorno>${urlReturn}</URLDiRitorno>`,
    '<Funzione>LOGIN</Funzione>',
    '<CodiceServizio>XXXX</CodiceServizio>',
    `<URLDiErrore>${urlErrore}</URLDiErrore>`,
    '<CIGStyle>',
    `<StyleSheet>${styleSheet}</StyleSheet>`,
    '<CustomStyle><![CDATA[<style type="text/css">body{background-color:white}</style>]]></CustomStyle>',
    `<URLLogo>${urlLogo}</URLLogo>`,
    '</CIGStyle>',
    '<ServiziStyle>',
    '<CustomStyle><![CDATA[<style type="text/css">bodyBODY{background-color:white}</style>]]></CustomStyle>',
    `<URLLogo>${urlLogo}</URLLogo>`,
    '</ServiziStyle>',
    '<MetodoAutenticazione>',
    '<UP>0</UP>',
    '<CIE>1</CIE>',
    '<INFOCAMERE>0</INFOCAMERE>',
    '<CRSCNS>1</CRSCNS>',
    '<ONLYSPID>1</ONLYSPID>',
    '</MetodoAutenticazione>',
    '</AuthRequest>',
  ].join('');
}

// --------------------------------------------------------------------------
// User XML parser (mirrors CIGUser deserialization)
// --------------------------------------------------------------------------

export interface CigUserData {
  codiceFiscale: string;
  nome: string;
  cognome: string;
  email: string | null;
  dataNascita: string | null;
  luogoNascita: string | null;
  sesso: string | null;
}

export function parseUserXml(xml: string): CigUserData | null {
  const personaStart = xml.indexOf('<Persona>');
  const personaEnd = xml.indexOf('</Persona>');
  if (personaStart < 0 || personaEnd < 0) return null;

  const persona = xml.substring(personaStart, personaEnd + '</Persona>'.length);

  const codiceFiscale = extractXmlTag(persona, 'CodiceFiscale').trim().toUpperCase();
  if (!codiceFiscale) return null;

  return {
    codiceFiscale,
    nome: extractXmlTag(persona, 'Nome').trim(),
    cognome: extractXmlTag(persona, 'Cognome').trim(),
    email: extractXmlTag(xml, 'EMail').trim() || null,
    dataNascita: extractXmlTag(persona, 'DataNascita').trim() || null,
    luogoNascita: extractXmlTag(persona, 'LuogoNascita').trim() || null,
    sesso: extractXmlTag(persona, 'Sesso').trim() || null,
  };
}
