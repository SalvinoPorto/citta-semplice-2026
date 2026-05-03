export function getCampoValue(campo: string) {
    if (campo === 'true') { return 'Si'; }
    else if (campo === 'false') { return 'No'; }
    else if (campo) return campo;
    else return '-';
}