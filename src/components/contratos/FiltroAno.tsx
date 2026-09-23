interface Props {
  anos: number[];
  valor: number | null;
  onChange: (ano: number | null) => void;
}

/** Filtro "Ano" reutilizado nas telas que listam contratos (Gestão de Contratos, Fiscal do Contrato, Contratos e ARP's). */
export default function FiltroAno({ anos, valor, onChange }: Props) {
  return (
    <select
      value={valor ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="block rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border"
      aria-label="Filtrar por ano"
    >
      <option value="">Todos os anos</option>
      {anos.map((ano) => (
        <option key={ano} value={ano}>
          {ano}
        </option>
      ))}
    </select>
  );
}
