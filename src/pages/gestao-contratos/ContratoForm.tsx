import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, PlusCircle, Save, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Contrato, ItemContrato } from '../../types';
import { ID_PLANILHA_CONTRATOS } from '../../lib/csv';
import { getAccessToken, googleSignIn, initAuth } from '../../lib/googleAuth';
import { uploadArquivoContrato } from '../../lib/driveUploadService';
import { enviarEmail } from '../../lib/emailService';
import { sincronizarContratoNaPlanilha } from '../../lib/sheetsService';
import { sincronizarContratoInstitucional } from '../../lib/sheetsInstitucionalService';
import { contratoParaDadosPlanilha } from '../../lib/planilhaContratos';
import { carregarMilitares, type Militar } from '../../lib/militares';
import BuscaMilitarInput from '../../components/contratos/BuscaMilitarInput';
import {
  formatarMoeda,
  mesclarItensContrato,
  somaValorItens,
  OPCOES_FONTE_RECURSO_CONTRATO,
  OPCOES_NATUREZA_DESPESA_CONTRATO,
} from '../../lib/contratos';

/** Unidades de medida mais comuns, oferecidas como sugestão no campo de item. */
const OPCOES_UNIDADE_ITEM = ['UND', 'PCT', 'JG', 'CONJ', 'CX', 'KG', 'L', 'M', 'M²', 'M³'];

interface ItemForm {
  id: string;
  descricao: string;
  unidade: string;
  quantidadeInicial: string;
  valorUnitario: string;
}

function itensParaFormulario(itens?: ItemContrato[]): ItemForm[] {
  return (itens ?? []).map((item) => ({
    id: item.id,
    descricao: item.descricao,
    unidade: item.unidade ?? '',
    quantidadeInicial: String(item.quantidadeInicial),
    // Itens cadastrados antes do valor unitário existir não têm esse
    // campo salvo — cai pra vazio em vez da string "undefined".
    valorUnitario: item.valorUnitario != null ? String(item.valorUnitario) : '',
  }));
}

const CLASSE_INPUT =
  'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm';
const CLASSE_LABEL = 'block text-sm font-medium text-gray-700';

interface FormState {
  pae: string;
  numero: string;
  objeto: string;
  empresa: string;
  cnpj: string;
  contatosFornecedor: string;
  contatoEmail: string;
  contatoTelefone: string;
  valorGlobal: string;
  saldoInicialFinanceiro: string;
  controlaQuantidade: boolean;
  saldoInicialQuantitativo: string;
  inicioVigencia: string;
  fimVigencia: string;
  fiscalTitular: string;
  fiscalEmail: string;
  fiscalTitularContato: string;
  fiscalTitularCargo: string;
  fiscalTitularMf: string;
  fiscalTitularUbm: string;
  fiscalSuplente: string;
  fiscalSuplenteEmail: string;
  fiscalSuplenteContato: string;
  fiscalSuplenteCargo: string;
  fiscalSuplenteMf: string;
  fiscalSuplenteUbm: string;
  portaria: string;
  fonteRecurso: string;
  naturezaDespesa: string;
  prd: string;
  valorPRD: string;
  empenho: string;
  dotacao: string;
  doe: string;
  linkContrato: string;
}

const estadoVazio: FormState = {
  pae: '',
  numero: '',
  objeto: '',
  empresa: '',
  cnpj: '',
  contatosFornecedor: '',
  contatoEmail: '',
  contatoTelefone: '',
  valorGlobal: '',
  saldoInicialFinanceiro: '',
  controlaQuantidade: false,
  saldoInicialQuantitativo: '',
  inicioVigencia: '',
  fimVigencia: '',
  fiscalTitular: '',
  fiscalEmail: '',
  fiscalTitularContato: '',
  fiscalTitularCargo: '',
  fiscalTitularMf: '',
  fiscalTitularUbm: '',
  fiscalSuplente: '',
  fiscalSuplenteEmail: '',
  fiscalSuplenteContato: '',
  fiscalSuplenteCargo: '',
  fiscalSuplenteMf: '',
  fiscalSuplenteUbm: '',
  portaria: '',
  fonteRecurso: '',
  naturezaDespesa: '',
  prd: '',
  valorPRD: '',
  empenho: '',
  dotacao: '',
  doe: '',
  linkContrato: '',
};

function contratoParaFormulario(contrato?: Contrato | null): FormState {
  if (!contrato) return estadoVazio;
  return {
    pae: contrato.pae ?? '',
    numero: contrato.numero ?? '',
    objeto: contrato.objeto ?? '',
    empresa: contrato.empresa ?? '',
    cnpj: contrato.cnpj ?? '',
    contatosFornecedor: contrato.contatosFornecedor ?? '',
    contatoEmail: contrato.contatoEmail ?? '',
    contatoTelefone: contrato.contatoTelefone ?? '',
    valorGlobal: contrato.valorGlobal != null ? String(contrato.valorGlobal) : '',
    saldoInicialFinanceiro:
      contrato.saldoInicialFinanceiro != null ? String(contrato.saldoInicialFinanceiro) : '',
    controlaQuantidade: contrato.saldoInicialQuantitativo != null,
    saldoInicialQuantitativo:
      contrato.saldoInicialQuantitativo != null ? String(contrato.saldoInicialQuantitativo) : '',
    // O <input type="date"> só aceita "aaaa-mm-dd" — cortar o restante
    // cobre tanto esse formato quanto o ISO completo (com hora) que a
    // sincronização com a planilha grava.
    inicioVigencia: contrato.inicioVigencia ? contrato.inicioVigencia.slice(0, 10) : '',
    fimVigencia: contrato.fimVigencia ? contrato.fimVigencia.slice(0, 10) : '',
    fiscalTitular: contrato.fiscalTitular ?? '',
    fiscalEmail: contrato.fiscalEmail ?? '',
    fiscalTitularContato: contrato.fiscalTitularContato ?? '',
    fiscalTitularCargo: contrato.fiscalTitularCargo ?? '',
    fiscalTitularMf: contrato.fiscalTitularMf ?? '',
    fiscalTitularUbm: contrato.fiscalTitularUbm ?? '',
    fiscalSuplente: contrato.fiscalSuplente ?? '',
    fiscalSuplenteEmail: contrato.fiscalSuplenteEmail ?? '',
    fiscalSuplenteContato: contrato.fiscalSuplenteContato ?? '',
    fiscalSuplenteCargo: contrato.fiscalSuplenteCargo ?? '',
    fiscalSuplenteMf: contrato.fiscalSuplenteMf ?? '',
    fiscalSuplenteUbm: contrato.fiscalSuplenteUbm ?? '',
    portaria: contrato.portaria ?? '',
    fonteRecurso: contrato.fonteRecurso ?? '',
    naturezaDespesa: contrato.naturezaDespesa ?? '',
    prd: contrato.prd ?? '',
    valorPRD: contrato.valorPRD != null ? String(contrato.valorPRD) : '',
    empenho: contrato.empenho ?? '',
    dotacao: contrato.dotacao ?? '',
    doe: contrato.doe ?? '',
    linkContrato: contrato.linkContrato ?? '',
  };
}

/**
 * Cadastro/edição de Contrato, como página normal (antes era um modal).
 * Em modo de cadastro, o Gestor informa o saldo inicial (financeiro e,
 * opcionalmente, quantitativo) que servirá de base para o abatimento das
 * execuções (NFs) lançadas depois.
 */
export default function ContratoForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contratos, addContrato, updateContrato } = useApp();

  const contrato = id ? contratos.find((c) => c.id === id) ?? null : null;
  const emEdicao = !!id;
  // Só trava o controle por quantidade quando o contrato JÁ tinha essa
  // baseline definida antes desta edição (evita alterar o saldo depois
  // de execuções já lançadas) — um contrato que nunca teve isso
  // configurado (ex.: importado da planilha, que não rastreia
  // quantidade) pode ativar normalmente na edição.
  const controleQuantidadeJaEstabelecido = contrato?.saldoInicialQuantitativo != null;

  useEffect(() => {
    const cancelar = initAuth();
    return () => cancelar();
  }, []);

  const [militares, setMilitares] = useState<Militar[]>([]);
  useEffect(() => {
    let cancelado = false;
    carregarMilitares()
      .then((lista) => {
        if (!cancelado) setMilitares(lista);
      })
      .catch((erro) => console.error('Erro ao carregar a planilha de militares:', erro));
    return () => {
      cancelado = true;
    };
  }, []);

  const [form, setForm] = useState<FormState>(() => contratoParaFormulario(contrato));
  const [itensForm, setItensForm] = useState<ItemForm[]>(() => itensParaFormulario(contrato?.itens));
  const [arquivoContrato, setArquivoContrato] = useState<File | null>(null);
  const [arquivoEmpenho, setArquivoEmpenho] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mostrarItens = form.controlaQuantidade;

  const handleItemChange = (id: string, campo: keyof Omit<ItemForm, 'id'>, valor: string) => {
    setItensForm((anterior) =>
      anterior.map((item) => (item.id === id ? { ...item, [campo]: valor } : item)),
    );
  };

  const handleAddItem = () => {
    setItensForm((anterior) => [
      ...anterior,
      { id: crypto.randomUUID(), descricao: '', unidade: '', quantidadeInicial: '', valorUnitario: '' },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItensForm((anterior) => anterior.filter((item) => item.id !== id));
  };

  const itensValidos = itensForm.filter((item) => item.descricao.trim());
  const totalItens = somaValorItens(
    itensValidos.map((item) => ({
      quantidadeInicial: Number(item.quantidadeInicial) || 0,
      valorUnitario: Number(item.valorUnitario) || 0,
    })),
  );
  const valorGlobalNumero = Number(form.valorGlobal) || 0;
  // Itens antigos (de antes do valor unitário existir) ficam com
  // valorUnitario zerado — não dá pra validar contra o Valor Global
  // nesse caso, ou qualquer edição nesse contrato (mesmo sem relação
  // com itens) ficaria travada sem explicação nenhuma. Só bloqueia
  // quando os itens têm de fato um preço lançado.
  const itensSemPreco = itensValidos.some((item) => !(Number(item.valorUnitario) > 0));
  // Poucos centavos de diferença por arredondamento não devem travar o
  // cadastro — só sinaliza quando a diferença é de fato relevante.
  const totalItensDivergente =
    mostrarItens &&
    itensValidos.length > 0 &&
    !itensSemPreco &&
    Math.abs(totalItens - valorGlobalNumero) > 0.01;
  const totalQuantidadeItens = itensValidos.reduce(
    (acc, item) => acc + (Number(item.quantidadeInicial) || 0),
    0,
  );

  const camposInvalidos =
    !form.numero ||
    !form.objeto ||
    !form.empresa ||
    !form.valorGlobal ||
    !form.saldoInicialFinanceiro ||
    !form.inicioVigencia ||
    !form.fimVigencia ||
    totalItensDivergente;

  const handleChange = (campo: keyof FormState, valor: string | boolean) => {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (camposInvalidos) return;
    setSalvando(true);
    setErro(null);
    try {
      // Pede a autorização do Google ANTES de gravar no Firestore: feita
      // depois, o popup de login perde a associação com o clique do
      // usuário e a maioria dos navegadores bloqueia silenciosamente.
      // O mesmo token serve tanto pra sincronizar com a planilha quanto
      // pra anexar o PDF do contrato no Drive.
      let googleToken: string | null = null;
      let erroGoogle: unknown = null;
      try {
        googleToken = await getAccessToken();
        if (!googleToken) {
          const resultado = await googleSignIn();
          googleToken = resultado?.accessToken ?? null;
        }
      } catch (erroAuth) {
        erroGoogle = erroAuth;
      }

      // O upload vai sempre pro Drive institucional (conta fixa ggc.cbmpa@gmail.com,
      // configurada no servidor) — não depende de qual conta Google a
      // pessoa logada autenticou, então todo documento do contrato cai
      // sempre na mesma pasta, não espalhado pelo Drive de cada um.
      let contratoPdfLink: string | null | undefined;
      let empenhoPdfLink: string | null | undefined;
      const pastaContrato = `Contrato ${form.numero} - ${form.empresa}`;
      if (arquivoContrato) {
        try {
          const arquivo = new File(
            [arquivoContrato],
            `Contrato_${form.numero.replace(/\//g, '-')}.pdf`,
            { type: arquivoContrato.type || 'application/pdf' },
          );
          contratoPdfLink = await uploadArquivoContrato(pastaContrato, arquivo);
        } catch (erroUpload) {
          console.error('Erro ao anexar o PDF do contrato:', erroUpload);
          alert(
            'Não foi possível anexar o PDF do contrato: ' +
              (erroUpload instanceof Error ? erroUpload.message : String(erroUpload)),
          );
        }
      }
      if (arquivoEmpenho) {
        try {
          const arquivo = new File(
            [arquivoEmpenho],
            `Empenho_${form.numero.replace(/\//g, '-')}.pdf`,
            { type: arquivoEmpenho.type || 'application/pdf' },
          );
          empenhoPdfLink = await uploadArquivoContrato(pastaContrato, arquivo);
        } catch (erroUpload) {
          console.error('Erro ao anexar a Nota de Empenho:', erroUpload);
          alert(
            'Não foi possível anexar a Nota de Empenho: ' +
              (erroUpload instanceof Error ? erroUpload.message : String(erroUpload)),
          );
        }
      }

      const dados: Omit<Contrato, 'id'> = {
        pae: form.pae,
        numero: form.numero,
        objeto: form.objeto,
        empresa: form.empresa,
        cnpj: form.cnpj || '',
        contatosFornecedor: form.contatosFornecedor || '',
        contatoEmail: form.contatoEmail || '',
        contatoTelefone: form.contatoTelefone || '',
        valorGlobal: Number(form.valorGlobal) || 0,
        saldoInicialFinanceiro: Number(form.saldoInicialFinanceiro) || 0,
        // Em cadastro, o AppContext força saldoAtual = saldoInicial; em
        // edição, o saldo atual não é alterado por este formulário.
        saldoAtualFinanceiro: emEdicao
          ? (contrato?.saldoAtualFinanceiro ?? (Number(form.saldoInicialFinanceiro) || 0))
          : Number(form.saldoInicialFinanceiro) || 0,
        ...(form.controlaQuantidade
          ? {
              // O saldo quantitativo agregado agora vem da soma das
              // quantidades dos itens, não de um número digitado à parte.
              saldoInicialQuantitativo: totalQuantidadeItens,
              saldoAtualQuantitativo: emEdicao
                ? (contrato?.saldoAtualQuantitativo ?? totalQuantidadeItens)
                : totalQuantidadeItens,
            }
          : {}),
        inicioVigencia: form.inicioVigencia,
        fimVigencia: form.fimVigencia,
        fiscalTitular: form.fiscalTitular || '',
        fiscalEmail: form.fiscalEmail || '',
        fiscalTitularContato: form.fiscalTitularContato || '',
        fiscalTitularCargo: form.fiscalTitularCargo || '',
        fiscalTitularMf: form.fiscalTitularMf || '',
        fiscalTitularUbm: form.fiscalTitularUbm || '',
        fiscalSuplente: form.fiscalSuplente || '',
        fiscalSuplenteEmail: form.fiscalSuplenteEmail || '',
        fiscalSuplenteContato: form.fiscalSuplenteContato || '',
        fiscalSuplenteCargo: form.fiscalSuplenteCargo || '',
        fiscalSuplenteMf: form.fiscalSuplenteMf || '',
        fiscalSuplenteUbm: form.fiscalSuplenteUbm || '',
        portaria: form.portaria || '',
        fonteRecurso: form.fonteRecurso || '',
        naturezaDespesa: form.naturezaDespesa || '',
        prd: form.prd || '',
        ...(form.valorPRD ? { valorPRD: Number(form.valorPRD.replace(',', '.')) } : {}),
        empenho: form.empenho || '',
        dotacao: form.dotacao || '',
        doe: form.doe || '',
        linkContrato: form.linkContrato || null,
        ...(mostrarItens
          ? {
              itens: mesclarItensContrato(
                contrato?.itens ?? [],
                itensValidos.map((item) => ({
                  id: item.id,
                  descricao: item.descricao.trim(),
                  // Não usar `unidade.trim() || undefined`: o Firestore
                  // rejeita `undefined` em qualquer campo do update,
                  // mesmo dentro de um array — omitir a chave em vez de
                  // setá-la como undefined.
                  ...(item.unidade.trim() ? { unidade: item.unidade.trim() } : {}),
                  quantidadeInicial: Number(item.quantidadeInicial) || 0,
                  valorUnitario: Number(item.valorUnitario) || 0,
                })),
              ),
            }
          : {}),
        ...(contratoPdfLink !== undefined ? { contratoPdfLink } : {}),
        ...(empenhoPdfLink !== undefined ? { empenhoPdfLink } : {}),
      };

      let contratoId: string;
      if (emEdicao && id) {
        await updateContrato(id, dados);
        contratoId = id;
      } else {
        contratoId = await addContrato(dados);
      }

      if (!googleToken) {
        alert(
          'O contrato foi salvo no sistema, mas não foi possível conectar ao Google para ' +
            'replicar na planilha automaticamente' +
            (erroGoogle instanceof Error ? `: ${erroGoogle.message}` : '.') +
            ' Adicione/atualize a linha manualmente ou tente sincronizar depois.',
        );
      } else {
        try {
          const linha = await sincronizarContratoNaPlanilha(
            googleToken,
            ID_PLANILHA_CONTRATOS,
            contratoParaDadosPlanilha(dados),
            contrato?.planilha_linha,
          );
          if (linha !== contrato?.planilha_linha) {
            await updateContrato(contratoId, { planilha_linha: linha });
          }
        } catch (erroPlanilha) {
          console.error('Erro ao gravar o contrato na planilha:', erroPlanilha);
          alert(
            'O contrato foi salvo no sistema, mas não foi possível gravá-lo na planilha automaticamente: ' +
              (erroPlanilha instanceof Error ? erroPlanilha.message : String(erroPlanilha)),
          );
        }
      }

      // Espelha o mesmo contrato na planilha institucional (Drive fixo,
      // ver server.ts) — best-effort, nunca bloqueia o cadastro.
      try {
        await sincronizarContratoInstitucional(contratoParaDadosPlanilha(dados));
      } catch (erroInstitucional) {
        console.error('Erro ao sincronizar a planilha institucional:', erroInstitucional);
        alert(
          'O contrato foi salvo no sistema, mas não foi possível atualizar a planilha institucional: ' +
            (erroInstitucional instanceof Error ? erroInstitucional.message : String(erroInstitucional)),
        );
      }

      // Avisa por e-mail sempre que um fiscal/suplente é definido ou
      // substituído — compara com o que já estava salvo antes (não
      // dispara de novo se a edição não mexeu nesses campos).
      const vigenciaFormatada = form.fimVigencia
        ? new Date(`${form.fimVigencia}T00:00:00`).toLocaleDateString('pt-BR')
        : 'não informada';
      try {
        if (dados.fiscalEmail && dados.fiscalEmail !== (contrato?.fiscalEmail ?? '')) {
          await enviarEmail({
            to: dados.fiscalEmail,
            subject: `Você foi designado Fiscal do Contrato ${form.numero}`,
            html: `
              <h2>Designação de Fiscal — Contrato ${form.numero}</h2>
              <p>Prezado(a) ${form.fiscalTitular || 'Fiscal'},</p>
              <p>Você foi designado(a) <b>Fiscal Titular</b> do contrato <b>${form.numero}</b>
              (${form.empresa}), com vigência até ${vigenciaFormatada}.</p>
              <p>Acesse o sistema, módulo Fiscal do Contrato, para mais detalhes.</p>
            `,
          });
        }
        if (
          dados.fiscalSuplenteEmail &&
          dados.fiscalSuplenteEmail !== (contrato?.fiscalSuplenteEmail ?? '')
        ) {
          await enviarEmail({
            to: dados.fiscalSuplenteEmail,
            subject: `Você foi designado Fiscal Suplente do Contrato ${form.numero}`,
            html: `
              <h2>Designação de Fiscal Suplente — Contrato ${form.numero}</h2>
              <p>Prezado(a) ${form.fiscalSuplente || 'Fiscal Suplente'},</p>
              <p>Você foi designado(a) <b>Fiscal Suplente</b> do contrato <b>${form.numero}</b>
              (${form.empresa}), com vigência até ${vigenciaFormatada}.</p>
              <p>Acesse o sistema, módulo Fiscal do Contrato, para mais detalhes.</p>
            `,
          });
        }
      } catch (erroEmail) {
        console.error('Erro ao notificar o novo fiscal/suplente por e-mail:', erroEmail);
        alert(
          'O contrato foi salvo, mas não foi possível enviar o e-mail de aviso ao novo fiscal/suplente: ' +
            (erroEmail instanceof Error ? erroEmail.message : String(erroEmail)),
        );
      }

      navigate('/sistema/gestao-contratos');
    } catch (erroCapturado) {
      setErro(
        erroCapturado instanceof Error
          ? erroCapturado.message
          : 'Não foi possível salvar o contrato.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {emEdicao ? `Editar Contrato nº ${contrato?.numero}` : 'Novo Contrato'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {emEdicao
              ? 'Atualize os dados cadastrais do contrato.'
              : 'Cadastre um novo contrato, informando o saldo inicial que servirá de base para as execuções (NFs).'}
          </p>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <form onSubmit={handleSalvar} className="p-6 space-y-6">
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md p-3">
              {erro}
            </div>
          )}

          {totalItensDivergente && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md p-3">
              Não é possível salvar: o total dos itens do contrato (mais abaixo, em "Vigência e
              Valores") não bate com o Valor Global. Ajuste os valores dos itens ou o Valor Global
              antes de salvar.
            </div>
          )}

          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
              Identificação
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={CLASSE_LABEL}>Nº do Processo (PAE)</label>
                <input
                  type="text"
                  value={form.pae}
                  onChange={(e) => handleChange('pae', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Nº do Contrato (nnnn/aaaa)</label>
                <input
                  type="text"
                  value={form.numero}
                  onChange={(e) => handleChange('numero', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Nº do DOE (Diário Oficial de publicação)</label>
                <input
                  type="text"
                  value={form.doe}
                  onChange={(e) => handleChange('doe', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div className="md:col-span-2">
                <label className={CLASSE_LABEL}>Objeto</label>
                <textarea
                  rows={2}
                  value={form.objeto}
                  onChange={(e) => handleChange('objeto', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Empresa Contratada</label>
                <input
                  type="text"
                  value={form.empresa}
                  onChange={(e) => handleChange('empresa', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>CNPJ</label>
                <input
                  type="text"
                  value={form.cnpj}
                  onChange={(e) => handleChange('cnpj', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Contato do Fornecedor</label>
                <input
                  type="text"
                  value={form.contatosFornecedor}
                  onChange={(e) => handleChange('contatosFornecedor', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>E-mail do Fornecedor</label>
                <input
                  type="email"
                  value={form.contatoEmail}
                  onChange={(e) => handleChange('contatoEmail', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Telefone do Fornecedor</label>
                <input
                  type="text"
                  value={form.contatoTelefone}
                  onChange={(e) => handleChange('contatoTelefone', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Link do Contrato</label>
                <input
                  type="text"
                  value={form.linkContrato}
                  onChange={(e) => handleChange('linkContrato', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>PDF do Contrato</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setArquivoContrato(e.target.files ? e.target.files[0] : null)}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                />
                {contrato?.contratoPdfLink && !arquivoContrato && (
                  <a
                    href={contrato.contratoPdfLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Ver PDF já anexado (escolher outro arquivo substitui)
                  </a>
                )}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
              Vigência e Valores
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={CLASSE_LABEL}>Início da Vigência</label>
                <input
                  type="date"
                  value={form.inicioVigencia}
                  onChange={(e) => handleChange('inicioVigencia', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Fim da Vigência</label>
                <input
                  type="date"
                  value={form.fimVigencia}
                  onChange={(e) => handleChange('fimVigencia', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Valor Global (R$)</label>
                <input
                  type="number"
                  value={form.valorGlobal}
                  onChange={(e) => handleChange('valorGlobal', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Saldo Financeiro Inicial (R$)</label>
                <input
                  type="number"
                  value={form.saldoInicialFinanceiro}
                  onChange={(e) => handleChange('saldoInicialFinanceiro', e.target.value)}
                  className={CLASSE_INPUT}
                  disabled={emEdicao}
                  title={
                    emEdicao
                      ? 'O saldo inicial não é alterado na edição; ele é abatido pelas execuções lançadas.'
                      : undefined
                  }
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  id="controlaQuantidade"
                  type="checkbox"
                  checked={form.controlaQuantidade}
                  onChange={(e) => handleChange('controlaQuantidade', e.target.checked)}
                  disabled={controleQuantidadeJaEstabelecido}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label htmlFor="controlaQuantidade" className="text-sm text-gray-700">
                  Este contrato também tem controle de saldo por quantidade (bens/materiais)
                </label>
              </div>
              {mostrarItens && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 mb-3">
                    Informe os itens do contrato — o saldo de quantidade é abatido item a item a
                    cada execução (NF) que informar consumo/recebimento.
                  </p>
                  <div className="space-y-3">
                    {itensForm.map((item) => {
                      const totalItem = (Number(item.quantidadeInicial) || 0) * (Number(item.valorUnitario) || 0);
                      return (
                        <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                          <input
                            type="text"
                            placeholder="Item (nome do objeto)"
                            value={item.descricao}
                            onChange={(e) => handleItemChange(item.id, 'descricao', e.target.value)}
                            className={`${CLASSE_INPUT} sm:col-span-4`}
                          />
                          <input
                            type="text"
                            list="opcoes-unidade-item"
                            placeholder="Unidade"
                            value={item.unidade}
                            onChange={(e) => handleItemChange(item.id, 'unidade', e.target.value)}
                            className={`${CLASSE_INPUT} sm:col-span-1`}
                          />
                          <input
                            type="number"
                            placeholder="Quantidade"
                            value={item.quantidadeInicial}
                            onChange={(e) => handleItemChange(item.id, 'quantidadeInicial', e.target.value)}
                            className={`${CLASSE_INPUT} sm:col-span-2`}
                          />
                          <input
                            type="number"
                            placeholder="Valor Unitário (R$)"
                            value={item.valorUnitario}
                            onChange={(e) => handleItemChange(item.id, 'valorUnitario', e.target.value)}
                            className={`${CLASSE_INPUT} sm:col-span-2`}
                          />
                          <div className={`${CLASSE_INPUT} sm:col-span-2 bg-gray-50 text-gray-700 flex items-center`}>
                            {formatarMoeda(totalItem)}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="sm:col-span-1 flex items-center justify-center text-gray-400 hover:text-red-600 py-2"
                            title="Remover item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                    <datalist id="opcoes-unidade-item">
                      {OPCOES_UNIDADE_ITEM.map((opcao) => (
                        <option key={opcao} value={opcao} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="inline-flex items-center text-sm font-medium text-red-700 hover:text-red-800"
                    >
                      <PlusCircle className="w-4 h-4 mr-1" />
                      Adicionar item
                    </button>
                  </div>

                  {itensValidos.length > 0 && (
                    <div
                      className={`mt-3 text-sm font-medium flex justify-between rounded-md p-3 ${
                        totalItensDivergente
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      <span>Total dos itens: {formatarMoeda(totalItens)}</span>
                      <span>Valor Global do contrato: {formatarMoeda(valorGlobalNumero)}</span>
                    </div>
                  )}
                  {totalItensDivergente && (
                    <p className="mt-1 text-xs text-red-600">
                      O total dos itens precisa bater com o Valor Global do contrato antes de salvar.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
              Fiscalização
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={CLASSE_LABEL}>Fiscal Titular</label>
                <BuscaMilitarInput
                  militares={militares}
                  value={form.fiscalTitular}
                  onChange={(valor) => handleChange('fiscalTitular', valor)}
                  onSelecionar={(militar) =>
                    setForm((anterior) => ({
                      ...anterior,
                      fiscalTitularCargo: militar.cargo,
                      fiscalTitularMf: militar.mf,
                      fiscalTitularUbm: militar.ubm || anterior.fiscalTitularUbm,
                    }))
                  }
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>E-mail do Fiscal Titular</label>
                <input
                  type="email"
                  value={form.fiscalEmail}
                  onChange={(e) => handleChange('fiscalEmail', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Contato do Fiscal Titular</label>
                <input
                  type="text"
                  value={form.fiscalTitularContato}
                  onChange={(e) => handleChange('fiscalTitularContato', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Cargo do Fiscal Titular</label>
                <input
                  type="text"
                  value={form.fiscalTitularCargo}
                  onChange={(e) => handleChange('fiscalTitularCargo', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>MF do Fiscal Titular</label>
                <input
                  type="text"
                  value={form.fiscalTitularMf}
                  onChange={(e) => handleChange('fiscalTitularMf', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>UBM do Fiscal Titular</label>
                <input
                  type="text"
                  value={form.fiscalTitularUbm}
                  onChange={(e) => handleChange('fiscalTitularUbm', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Fiscal Suplente</label>
                <BuscaMilitarInput
                  militares={militares}
                  value={form.fiscalSuplente}
                  onChange={(valor) => handleChange('fiscalSuplente', valor)}
                  onSelecionar={(militar) =>
                    setForm((anterior) => ({
                      ...anterior,
                      fiscalSuplenteCargo: militar.cargo,
                      fiscalSuplenteMf: militar.mf,
                      fiscalSuplenteUbm: militar.ubm || anterior.fiscalSuplenteUbm,
                    }))
                  }
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>E-mail do Fiscal Suplente</label>
                <input
                  type="email"
                  value={form.fiscalSuplenteEmail}
                  onChange={(e) => handleChange('fiscalSuplenteEmail', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Contato do Fiscal Suplente</label>
                <input
                  type="text"
                  value={form.fiscalSuplenteContato}
                  onChange={(e) => handleChange('fiscalSuplenteContato', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Cargo do Fiscal Suplente</label>
                <input
                  type="text"
                  value={form.fiscalSuplenteCargo}
                  onChange={(e) => handleChange('fiscalSuplenteCargo', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>MF do Fiscal Suplente</label>
                <input
                  type="text"
                  value={form.fiscalSuplenteMf}
                  onChange={(e) => handleChange('fiscalSuplenteMf', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>UBM do Fiscal Suplente</label>
                <input
                  type="text"
                  value={form.fiscalSuplenteUbm}
                  onChange={(e) => handleChange('fiscalSuplenteUbm', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Nº da Portaria de Fiscalização</label>
                <input
                  type="text"
                  value={form.portaria}
                  onChange={(e) => handleChange('portaria', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
            </div>

            {contrato?.historicoFiscal && contrato.historicoFiscal.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Histórico de Fiscais Anteriores</p>
                <ul className="space-y-1">
                  {contrato.historicoFiscal
                    .slice()
                    .reverse()
                    .map((periodo) => (
                      <li key={periodo.id} className="text-xs text-gray-600">
                        {periodo.fiscalTitular || 'Sem titular'}
                        {periodo.fiscalSuplente ? ` (suplente: ${periodo.fiscalSuplente})` : ''} —{' '}
                        {new Date(periodo.desde).toLocaleDateString('pt-BR')} a{' '}
                        {new Date(periodo.ate).toLocaleDateString('pt-BR')}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
              Dados Orçamentários
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={CLASSE_LABEL}>Fonte de Recurso</label>
                <select
                  value={form.fonteRecurso}
                  onChange={(e) => handleChange('fonteRecurso', e.target.value)}
                  className={`${CLASSE_INPUT} bg-white`}
                >
                  <option value="">Selecione...</option>
                  {OPCOES_FONTE_RECURSO_CONTRATO.map((opcao) => (
                    <option key={opcao} value={opcao}>{opcao}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={CLASSE_LABEL}>Natureza de Despesa</label>
                <select
                  value={form.naturezaDespesa}
                  onChange={(e) => handleChange('naturezaDespesa', e.target.value)}
                  className={`${CLASSE_INPUT} bg-white`}
                >
                  <option value="">Selecione...</option>
                  {OPCOES_NATUREZA_DESPESA_CONTRATO.map((opcao) => (
                    <option key={opcao} value={opcao}>{opcao}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={CLASSE_LABEL}>PRD</label>
                <input
                  type="text"
                  value={form.prd}
                  onChange={(e) => handleChange('prd', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Valor do PRD (R$)</label>
                <input
                  type="number"
                  value={form.valorPRD}
                  onChange={(e) => handleChange('valorPRD', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Empenho</label>
                <input
                  type="text"
                  value={form.empenho}
                  onChange={(e) => handleChange('empenho', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Dotação</label>
                <input
                  type="text"
                  value={form.dotacao}
                  onChange={(e) => handleChange('dotacao', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>PDF da Nota de Empenho</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setArquivoEmpenho(e.target.files ? e.target.files[0] : null)}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                />
                {contrato?.empenhoPdfLink && !arquivoEmpenho && (
                  <a
                    href={contrato.empenhoPdfLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Ver Nota de Empenho já anexada (escolher outro arquivo substitui)
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || camposInvalidos}
              className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Save className="-ml-1 mr-2 h-5 w-5" />
              {salvando ? 'Salvando...' : 'Salvar Contrato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
