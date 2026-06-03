import React, { useState } from 'react';
import { X, Send, AlertTriangle, Clock, Activity, CheckCircle } from 'lucide-react';

interface AlertasModalProps {
  isOpen: boolean;
  onClose: () => void;
  contratos: any[];
}

export function AlertasModal({ isOpen, onClose, contratos }: AlertasModalProps) {
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{sucesso: boolean, mensagem: string} | null>(null);
  
  if (!isOpen) return null;

  // Analisa contratos que precisam de alerta
  const hoje = new Date();
  
  const alertasVencimento = contratos.filter(c => {
    if (!c.vigenciaFim) return false;
    const fim = new Date(c.vigenciaFim);
    const diffTime = Math.abs(fim.getTime() - hoje.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Alerta se faltam menos de 60 dias
    return fim >= hoje && diffDays <= 60;
  });

  const alertasSaldo = contratos.filter(c => {
    // Alerta se o saldo for menor ou igual a 20% do valor total
    if (!c.valor || !c.saldo) return false;
    const porcentagem = (c.saldo / c.valor) * 100;
    return porcentagem <= 20;
  });

  const alertasGeral = [...new Set([...alertasVencimento, ...alertasSaldo])];

  const dispararAlertas = async () => {
    setEnviando(true);
    setResultado(null);
    let enviados = 0;
    
    try {
      for (const contrato of alertasGeral) {
        let motivoStr = [];
        if (alertasVencimento.includes(contrato)) motivoStr.push('vencimento próximo');
        if (alertasSaldo.includes(contrato)) motivoStr.push('saldo baixo (< 20%)');

        const corpo = `
          <h2>Alerta de Contrato - ${contrato.numero}</h2>
          <p>Prezado Fiscal,</p>
          <p>Este é um alerta automático do sistema informando as seguintes urgências para o contrato <b>${contrato.numero}</b> (${contrato.fornecedor}):</p>
          <ul>
            ${motivoStr.map(m => `<li><b>Atenção:</b> ${m}</li>`).join('')}
          </ul>
          <p>Lembre-se também de observar o prazo regular para o envio de e conferência de Notas Fiscais/Faturas e recibos para pagamento em tempo hábil.</p>
          <hr/>
          <p><b>Dados do Contrato:</b></p>
          <p>Fim da Vigência: ${contrato.vigenciaFim}<br/>Saldo Atual: R$ ${String(contrato.saldo)}</p>
        `;

        if (contrato.contatoEmail) {
          const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: contrato.contatoEmail, // Envia para o contato cadastrado ou do fiscal (simulado)
              subject: `[ALERTA AUTOMÁTICO] Contrato ${contrato.numero} - Ações Necessárias`,
              html: corpo
            })
          });
          
          if (res.ok) {
            enviados++;
          }
        }
      }
      
      setResultado({
        sucesso: true,
        mensagem: `Foram processados e enviados ${enviados} alertas com sucesso aos fiscais responsáveis.`
      });
      
    } catch (error) {
      console.error(error);
      setResultado({
        sucesso: false,
        mensagem: 'Ocorreu um erro ao disparar os alertas.'
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75" onClick={onClose}>
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl transform transition-all flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium leading-6 text-gray-900 flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5 text-indigo-500" />
            Painel de Alertas Automáticos
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-gray-500 mb-6">
            O sistema envia alertas automáticos por e-mail para os fiscais informando sobre o <b>término próximo dos contratos (≤ 60 dias)</b>, o <b>prazo para envio de NF/Faturas e/ou recibos</b>, e quando o <b>nível do saldo for insatisfatório (≤ 20%)</b>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-orange-50 border border-orange-100 p-4 rounded-lg flex items-start">
              <Clock className="w-5 h-5 text-orange-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-orange-900">Vencimento Próximo</h4>
                <p className="text-2xl font-bold text-orange-700 mt-1">{alertasVencimento.length}</p>
                <p className="text-xs text-orange-800 mt-1">contratos em atenção</p>
              </div>
            </div>
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-lg flex items-start">
              <Activity className="w-5 h-5 text-rose-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-rose-900">Saldo Crítico</h4>
                <p className="text-2xl font-bold text-rose-700 mt-1">{alertasSaldo.length}</p>
                <p className="text-xs text-rose-800 mt-1">contratos com saldo ≤ 20%</p>
              </div>
            </div>
          </div>
          
          {resultado && (
            <div className={`p-4 rounded-md mb-4 flex items-center ${resultado.sucesso ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <CheckCircle className="w-5 h-5 mr-2" />
              {resultado.mensagem}
            </div>
          )}

          {alertasGeral.length > 0 ? (
            <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contrato</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Motivo(s)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fiscal Info</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {alertasGeral.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">#{c.numero}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <div className="flex flex-col gap-1">
                          {alertasVencimento.includes(c) && <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Vencimento</span>}
                          {alertasSaldo.includes(c) && <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">Saldo Baixo</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {c.fiscalTitular || 'N/A'}<br/>
                        <span className="text-xs text-gray-400">{c.contatoEmail || 'Sem email'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 border border-gray-200 rounded-lg">
              <CheckCircle className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-900">Sem alertas pendentes</p>
              <p className="text-sm text-gray-500 mt-1">Todos os contratos estão normais no momento.</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={dispararAlertas}
            disabled={enviando || alertasGeral.length === 0}
            className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
              enviando || alertasGeral.length === 0 ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
            }`}
          >
            <Send className="w-4 h-4 mr-2" />
            {enviando ? 'Enviando...' : 'Disparar Emails'}
          </button>
        </div>
      </div>
    </div>
  );
}
