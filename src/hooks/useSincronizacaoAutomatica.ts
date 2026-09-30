import { useEffect, useRef } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { useApp } from '../context/AppContext';
import { getDb } from '../lib/firebase';
import { URL_PLANILHA_CONTRATOS, URL_PLANILHA_PROCESSOS } from '../lib/csv';

const INTERVALO_MS = 5 * 60 * 1000;
// Dá tempo das coleções (processos, estadas, contratos) chegarem do
// Firestore antes da primeira execução — sincronizar com a lista ainda
// vazia criaria tudo em duplicidade.
const ATRASO_INICIAL_MS = 30 * 1000;

/**
 * "Turno" de sincronização no Firestore: com vários navegadores abertos
 * ao mesmo tempo, só um assume cada rodada (quem gravar `ultimaExecucao`
 * primeiro, dentro de uma transação) — evita sincronizações simultâneas,
 * que criariam processos/contratos duplicados e notificações repetidas.
 */
async function assumirVez(chave: 'processos' | 'contratos'): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const referencia = doc(db, 'sincronizacoes', chave);
  try {
    return await runTransaction(db, async (transacao) => {
      const snapshot = await transacao.get(referencia);
      const ultima = snapshot.exists() ? Date.parse(snapshot.data().ultimaExecucao) : 0;
      if (Number.isFinite(ultima) && Date.now() - ultima < INTERVALO_MS - 30_000) return false;
      transacao.set(referencia, { ultimaExecucao: new Date().toISOString() });
      return true;
    });
  } catch (erro) {
    console.error(`Não foi possível assumir a sincronização de ${chave}:`, erro);
    return false;
  }
}

/**
 * Sincroniza sozinho, a cada poucos minutos e enquanto o sistema estiver
 * aberto, as planilhas de processos (perfis master/apoio) e de contratos
 * (master/contratos/gestão) — os mesmos perfis que já tinham o botão
 * manual "Sincronizar". As sincronizações só gravam o que mudou na
 * planilha, então o custo em escritas do Firestore é baixo.
 */
export function useSincronizacaoAutomatica() {
  const { usuarioAtual, processos, estadasProcesso, contratos, syncProcessosDaPlanilha, syncContratosDaPlanilha } = useApp();
  const perfil = usuarioAtual?.perfil;
  const podeProcessos = perfil === 'master' || perfil === 'apoio';
  const podeContratos = perfil === 'master' || perfil === 'contratos' || perfil === 'gestao';

  // Sempre a versão mais recente das funções/listas, sem reiniciar o timer a cada render.
  const atual = useRef({ processos, estadasProcesso, contratos, syncProcessosDaPlanilha, syncContratosDaPlanilha });
  useEffect(() => {
    atual.current = { processos, estadasProcesso, contratos, syncProcessosDaPlanilha, syncContratosDaPlanilha };
  });

  useEffect(() => {
    if (!podeProcessos && !podeContratos) return;

    let executando = false;

    const rodar = async () => {
      if (executando || document.visibilityState !== 'visible') return;
      executando = true;
      try {
        if (podeProcessos) {
          try {
            const { processos: p, estadasProcesso: e } = atual.current;
            if (p.length > 0 && e.length > 0 && (await assumirVez('processos'))) {
              await atual.current.syncProcessosDaPlanilha(URL_PLANILHA_PROCESSOS);
            }
          } catch (erro) {
            console.error('Sincronização automática de processos falhou:', erro);
          }
        }
        if (podeContratos) {
          try {
            if (atual.current.contratos.length > 0 && (await assumirVez('contratos'))) {
              await atual.current.syncContratosDaPlanilha(URL_PLANILHA_CONTRATOS);
            }
          } catch (erro) {
            console.error('Sincronização automática de contratos falhou:', erro);
          }
        }
      } finally {
        executando = false;
      }
    };

    const inicial = setTimeout(rodar, ATRASO_INICIAL_MS);
    const intervalo = setInterval(rodar, INTERVALO_MS);
    return () => {
      clearTimeout(inicial);
      clearInterval(intervalo);
    };
  }, [podeProcessos, podeContratos]);
}
