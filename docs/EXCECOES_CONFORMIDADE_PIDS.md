# Registro de Exceções de Conformidade — PIDS/DTIC

> Documento previsto no art. 16.2 da Política Institucional de
> Desenvolvimento de Sistemas (PIDS/DTIC): toda exceção à política deve ser
> "registrada, justificada e, sempre que possível, acompanhada de plano de
> adequação posterior". Este documento formaliza as exceções conhecidas do
> Sistema de Controle de Processos e deve ser apresentado à DTIC como parte
> do processo de acolhimento (Capítulo 14).

## Exceção 1 — Autenticação fora do Keycloak

- **Dispositivo da política:** art. 7.1 — autenticação institucional
  centralizada, preferencialmente via Keycloak.
- **Situação atual:** o sistema usa Firebase Authentication (e-mail/senha),
  com um fluxo próprio de primeiro acesso por matrícula (MF), validada contra
  uma planilha pública do efetivo do CBMPA.
- **Justificativa técnica:** o sistema foi desenvolvido por iniciativa
  setorial, antes da publicação desta política, sem acesso a um client/realm
  Keycloak configurado para este tipo de sistema. Não há, até o momento,
  orientação técnica da DTIC sobre como integrar um sistema setorial ao
  provedor de identidade institucional.
- **Risco associado:** multiplicidade de credenciais para o usuário final;
  ausência de expiração/revogação automática de acesso vinculada ao
  desligamento/transferência do militar (hoje depende de ação manual do
  master).
- **Plano de adequação:** migrar a autenticação para Keycloak assim que a
  DTIC disponibilizar as credenciais de integração (client ID/secret, realm)
  — ver Trilha C do relatório de adequação. Prioridade a ser definida
  conjuntamente com a DTIC, considerando o esforço de migração de todos os
  usuários já cadastrados.

## Exceção 2 — Ausência de integração com o SI3

- **Dispositivo da política:** art. 8.1 — uso do SI3 como base institucional
  de referência para dados de pessoas/militares, evitando cadastros
  paralelos.
- **Situação atual:** o vínculo entre fiscais e contratos usa uma planilha
  pública do Google Sheets ("Militares e Matrícula BM"), mantida fora do
  sistema, como fonte de nome/cargo/matrícula.
- **Justificativa técnica:** o sistema não possui credenciais de acesso à API
  do SI3. A planilha pública foi adotada como solução funcional viável sem
  depender de integração institucional ainda não disponibilizada.
- **Risco associado:** possibilidade de dados desatualizados ou divergentes
  do cadastro oficial (a planilha depende de atualização manual por terceiros
  fora do controle deste sistema); persistência de um "cadastro paralelo",
  exatamente o cenário que a política busca eliminar.
- **Plano de adequação:** substituir a leitura da planilha por consulta à API
  do SI3 assim que a DTIC disponibilizar credenciais/documentação de
  integração — ver Trilha C do relatório de adequação.

## Exceção 3 — Ausência de ambiente de homologação

- **Dispositivo da política:** art. 5.1 e art. 10.1 — separação entre
  ambientes de desenvolvimento, homologação e produção.
- **Situação atual:** existe apenas o ambiente de produção. Mudanças
  aprovadas no CI (testes automatizados + build) vão diretamente para
  produção.
- **Justificativa técnica:** infraestrutura atual (uma única VPS) não
  comporta ambiente de homologação sem custo adicional; o volume de usuários
  e a criticidade atual do sistema tornaram esse risco aceitável até o
  momento, mitigado por uma esteira de testes automatizados antes de cada
  implantação.
- **Risco associado:** uma regressão que passe pelos testes automatizados
  mas falhe em cenários reais só é percebida em produção.
- **Plano de adequação:** avaliar, junto à DTIC, a viabilidade de um
  ambiente de homologação compartilhado ou próprio, proporcional à
  criticidade do sistema.

---

Este registro deve ser revisado a cada nova exceção identificada e sempre que
uma das exceções acima for sanada.
