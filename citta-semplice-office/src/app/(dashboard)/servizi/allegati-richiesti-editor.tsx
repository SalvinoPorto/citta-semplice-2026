'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';

export interface AllegatoRichiestoItem {
  id?: number;
  nomeAllegatoRichiesto: string;
  obbligatorio: boolean;
  interno: boolean;
  soggetto: 'UT' | 'OP';
}

interface Props {
  value: AllegatoRichiestoItem[];
  onChange: (items: AllegatoRichiestoItem[]) => void;
  prefix: string;
}

const emptyItem = (): AllegatoRichiestoItem => ({
  nomeAllegatoRichiesto: '',
  obbligatorio: false,
  interno: false,
  soggetto: 'UT',
});

export function AllegatiRichiestiEditor({ value, onChange, prefix }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<AllegatoRichiestoItem | null>(null);

  const startAdd = () => {
    setEditingIndex(-1);
    setEditingItem(emptyItem());
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditingItem({ ...value[index] });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingItem(null);
  };

  const saveEdit = () => {
    if (!editingItem || !editingItem.nomeAllegatoRichiesto.trim()) return;
    if (editingIndex === -1) {
      onChange([...value, editingItem]);
    } else {
      const updated = [...value];
      updated[editingIndex!] = editingItem;
      onChange(updated);
    }
    cancelEdit();
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    if (editingIndex === index) cancelEdit();
  };

  return (
    <div className="mt-2 p-3 bg-light rounded border">
      {value.length > 0 && (
        <table className="table table-sm table-bordered mb-2">
          <thead className="table-light">
            <tr>
              <th style={{ width: "50%" }}>Nome allegato</th>
              <th className="text-center" style={{ width: "10%" }}>Obbligatorio</th>
              <th className="text-center" style={{ width: "10%" }}>Interno</th>
              <th className="text-center" style={{ width: "10%" }}>Soggetto</th>
              <th style={{ width: "20%" }}></th>
            </tr>
          </thead>
          <tbody>
            {value.map((item, i) => (
              <tr key={i}>
                <td className="small align-middle">{item.nomeAllegatoRichiesto}</td>
                <td className="text-center align-middle">
                  <span className={`badge ${item.obbligatorio ? 'bg-danger' : 'bg-secondary'}`}>
                    {item.obbligatorio ? 'Sì' : 'No'}
                  </span>
                </td>
                <td className="text-center align-middle">
                  <span className={`badge ${item.interno ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                    {item.interno ? 'Sì' : 'No'}
                  </span>
                </td>
                <td className="text-center align-middle">
                  <span className={`badge ${item.soggetto === 'UT' ? 'bg-primary' : 'bg-info text-dark'}`}>
                    {item.soggetto === 'UT' ? 'Utente' : 'Operatore'}
                  </span>
                </td>
                <td className="text-center align-middle">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary me-1"
                    onClick={() => startEdit(i)}
                    title="Modifica"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => removeItem(i)}
                    title="Elimina"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingItem !== null ? (
        <div className="border rounded p-3 bg-white mb-2">
          <h6 className="mb-3 small fw-bold">
            {editingIndex === -1 ? 'Nuovo allegato richiesto' : 'Modifica allegato'}
          </h6>

          <div className="mb-2">
            <Input
              type="text"
              label="Nome allegato *"
              value={editingItem.nomeAllegatoRichiesto}
              onChange={(e) => setEditingItem({ ...editingItem, nomeAllegatoRichiesto: e.target.value })}
              placeholder="es. Documento d'identità"
            />
          </div>

          <div className="row mb-2">
            <div className="col">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id={`${prefix}-obbligatorio`}
                  checked={editingItem.obbligatorio}
                  onChange={(e) => setEditingItem({ ...editingItem, obbligatorio: e.target.checked })}
                />
                <label className="form-check-label small" htmlFor={`${prefix}-obbligatorio`}>
                  Obbligatorio
                </label>
              </div>
            </div>
            <div className="col">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id={`${prefix}-interno`}
                  checked={editingItem.interno}
                  onChange={(e) => setEditingItem({ ...editingItem, interno: e.target.checked })}
                />
                <label className="form-check-label small" htmlFor={`${prefix}-interno`}>
                  Interno (non visibile al richiedente)
                </label>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small">Soggetto</label>
            <div className="d-flex gap-3">
              <div className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  id={`${prefix}-soggetto-ut`}
                  checked={editingItem.soggetto === 'UT'}
                  onChange={() => setEditingItem({ ...editingItem, soggetto: 'UT' })}
                />
                <label className="form-check-label small" htmlFor={`${prefix}-soggetto-ut`}>
                  Utente (richiedente)
                </label>
              </div>
              <div className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  id={`${prefix}-soggetto-op`}
                  checked={editingItem.soggetto === 'OP'}
                  onChange={() => setEditingItem({ ...editingItem, soggetto: 'OP' })}
                />
                <label className="form-check-label small" htmlFor={`${prefix}-soggetto-op`}>
                  Operatore
                </label>
              </div>
            </div>
          </div>

          <div className="d-flex gap-2">
            <Button type="button" variant="primary" onClick={saveEdit}>
              {editingIndex === -1 ? 'Aggiungi' : 'Salva'}
            </Button>
            <Button type="button" variant="secondary" onClick={cancelEdit}>
              Annulla
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={startAdd}>
          + Aggiungi allegato
        </button>
      )}
    </div>
  );
}
