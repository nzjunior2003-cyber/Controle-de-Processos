import { useState, useEffect } from 'react';
import Papa from 'papaparse';

export interface Militar {
  nome: string;
  matricula: string;
  cargo: string;
}

export function useMilitares() {
  const [militares, setMilitares] = useState<Militar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch if not already fetched
    const fetchMilitares = async () => {
      try {
        setLoading(true);
        const res = await fetch('https://docs.google.com/spreadsheets/d/1Ja9mQVJ4KWkFtjNBjuoSONnKoj2GIT7ltUYAByLetrg/export?format=csv');
        const csv = await res.text();
        
        Papa.parse(csv, {
          header: true,
          complete: (results) => {
            const parsed = results.data
              .filter((row: any) => row.nome) 
              .map((row: any) => ({
                nome: row.nome,
                matricula: String(row.matricula || ''),
                cargo: row.cargo || ''
              }));
            setMilitares(parsed);
          }
        });
      } catch (err) {
        console.error('Failed to load militares', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMilitares();
  }, []);

  return { militares, loading };
}
