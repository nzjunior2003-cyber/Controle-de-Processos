import { useEffect } from 'react';
import { prepararTodas } from '../../lib/tabelasResponsivas';

/** Mantém as tabelas da tela preparadas para virar cartões no celular (ver lib/tabelasResponsivas.ts). */
export default function TabelasResponsivas() {
  useEffect(() => {
    let agendado = 0;
    const executar = () => {
      agendado = 0;
      prepararTodas(document);
    };
    const observador = new MutationObserver(() => {
      if (!agendado) agendado = window.requestAnimationFrame(executar);
    });
    executar();
    observador.observe(document.body, { childList: true, subtree: true });
    return () => {
      observador.disconnect();
      if (agendado) window.cancelAnimationFrame(agendado);
    };
  }, []);
  return null;
}
