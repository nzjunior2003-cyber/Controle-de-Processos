import { describe, expect, it } from 'vitest';
import {
  ETAPAS_PADRAO,
  RITO_ADESAO_ARP,
  normalizarRito,
  unificarEtapasPorRito,
} from './ritosProcessuais';

describe('normalizarRito', () => {
  it('leva os nomes antigos pro nome canônico', () => {
    expect(normalizarRito('Adesão ARP')).toBe(RITO_ADESAO_ARP);
    expect(normalizarRito('Pregão Eletrônico (SRP)')).toBe('Pregão Eletrônico p/ Registro de preços');
    expect(normalizarRito('Gerenciador da ARP')).toBe('Gerenciador da Ata de Registro de Preços');
    expect(normalizarRito('Partícipe de ARP')).toBe('Partícipe de uma ata de registro de preços');
    expect(normalizarRito('Inexigibilidade (com as suas variantes)')).toBe('Inexigibilidade');
  });

  it('tira o valor em reais dos ritos de dispensa por valor, seja qual for o valor', () => {
    const esperado1 = 'Dispensa por valor (Decreto 2.787, Art. 3º, II. Lei 14.133, Art. 75, II.)';
    expect(normalizarRito('Dispensa por valor R$ 59,906,02\n(Decreto 2.787, Art. 3º, II. Lei 14.133, Art. 75, II.)')).toBe(esperado1);
    expect(normalizarRito('Dispensa por valor R$ 62.000,00\n(Decreto 2.787, Art. 3º, II. Lei 14.133, Art. 75, II.)')).toBe(esperado1);

    const esperado2 = 'Dispensa por valor irrisório (Dec. N°2.787/22, Art. 3º, §6º)';
    expect(normalizarRito('Dispensa por Valor irrisório R$ 2.995,30 \n(Dec. N°2.787/22, Art. 3º, §6º)')).toBe(esperado2);
  });

  it('ignora caixa, acentos e espaços ao casar', () => {
    expect(normalizarRito('  PREGÃO   ELETRÔNICO ')).toBe('Pregão Eletrônico');
    expect(normalizarRito('adesao arp')).toBe(RITO_ADESAO_ARP);
  });

  it('mantém ritos desconhecidos e valores ausentes', () => {
    expect(normalizarRito('Rito Novo da Planilha ')).toBe('Rito Novo da Planilha');
    expect(normalizarRito(undefined)).toBeUndefined();
    expect(normalizarRito('')).toBe('');
  });
});

describe('unificarEtapasPorRito', () => {
  it('fica com o checklist que tiver mais itens entre as fontes', () => {
    const antigo = { 'Adesão ARP': ['a', 'b', 'c'] };
    const planilha = { 'Adesão à ata de registro de preços': ['a', 'b', 'c', 'd', 'e'] };
    expect(unificarEtapasPorRito(antigo, planilha)[RITO_ADESAO_ARP]).toEqual(['a', 'b', 'c', 'd', 'e']);

    const antigoMaior = { 'Adesão ARP': ['a', 'b', 'c', 'd'] };
    const planilhaMenor = { 'Adesão à ata de registro de preços': ['a'] };
    expect(unificarEtapasPorRito(antigoMaior, planilhaMenor)[RITO_ADESAO_ARP]).toEqual(['a', 'b', 'c', 'd']);
  });

  it('em empate de tamanho, vale a fonte que vem por último', () => {
    const resultado = unificarEtapasPorRito({ Inexigibilidade: ['x', 'y'] }, { Inexigibilidade: ['p', 'q'] });
    expect(resultado.Inexigibilidade).toEqual(['p', 'q']);
  });

  it('não repete o mesmo rito sob nomes diferentes', () => {
    const resultado = unificarEtapasPorRito(
      { 'Pregão Eletrônico (SRP)': ['a'] },
      { 'Pregão Eletrônico p/ Registro de preços': ['a', 'b'] },
    );
    expect(Object.keys(resultado)).toEqual(['Pregão Eletrônico p/ Registro de preços']);
  });

  it('tira do menu os ritos genéricos antigos sem equivalente', () => {
    const resultado = unificarEtapasPorRito({
      'Dispensa de Licitação (com suas variantes)': ['a'],
      'Aditivo Contratual (Tempo, Valor ou tempo e valor)': ['a'],
      Outro: ['a'],
    });
    expect(Object.keys(resultado)).toEqual(['Outro']);
  });

  it('mantém ritos novos da planilha, depois dos canônicos', () => {
    const resultado = unificarEtapasPorRito({ Outro: ['a'] }, { 'Rito Novo': ['a'], 'Pregão Eletrônico': ['a'] });
    expect(Object.keys(resultado)).toEqual(['Pregão Eletrônico', 'Outro', 'Rito Novo']);
  });
});

describe('ETAPAS_PADRAO', () => {
  it('usa só nomes canônicos e não traz os genéricos removidos', () => {
    const nomes = Object.keys(ETAPAS_PADRAO);
    expect(nomes).toContain('Pregão Eletrônico p/ Registro de preços');
    expect(nomes).not.toContain('Pregão Eletrônico (SRP)');
    expect(nomes).not.toContain('Adesão ARP');
    expect(nomes).not.toContain('Dispensa de Licitação (com suas variantes)');
  });
});
