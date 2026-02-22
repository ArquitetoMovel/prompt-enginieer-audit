# Plano de Alteração: Migração para LLM Corporativa (Self-Hosted)

## 1. Visão Geral da Arquitetura Atual vs. Proposta

Atualmente, no arquivo `backend/app/workflow/nodes.py` (linha 166), a LLM é instanciada da seguinte forma:

```python
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
```

Por padrão, o `ChatOpenAI` busca a variável de ambiente `OPENAI_API_KEY` e faz requisições diretamente para `api.openai.com`.

**O objetivo da mudança** é interceptar esse comportamento e redirecionar a chamada para a URL base (endpoint) do provedor interno da sua corporação, gerenciando a autenticação corporativa exigida por ele.

---

## 2. Passos para a Implementação

### Passo 1: Definição de Variáveis de Ambiente (`.env`)

Para manter a segurança e a flexibilidade entre ambientes (ex: local, homologação e produção), não devemos utilizar URLs fixas (hardcoded) no código.

**Ação:** Adicionar novas variáveis no arquivo `.env` (ou no gerenciador de secrets/deploy):

```env
# Configurações da LLM Corporativa
CORPORATE_LLM_BASE_URL="https://api-llm.sua-empresa.com.br/v1"
CORPORATE_LLM_API_KEY="sk-chave-de-acesso-interna"
CORPORATE_LLM_MODEL_NAME="gpt-4o-mini-corporativo" # (Opcional) caso o provider mapeie nomes de modelos diferentes
```

### Passo 2: Atualização do Módulo de Configuração

**Ação:** No arquivo `app/core/config.py` (referenciado como `settings` no seu arquivo `nodes.py`), será necessário mapear essas novas variáveis de ambiente na classe de configuração (usualmente Pydantic `BaseSettings`).

### Passo 3: Alteração da Chamada no `nodes.py`

A biblioteca `langchain_openai.ChatOpenAI` é perfeitamente flexível para acessar proxies ou instâncias self-hosted compatíveis com a especificação da OpenAI.

**Ação:** Em `backend/app/workflow/nodes.py`, a linha `166` deverá ser alterada para incluir os parâmetros customizados puxados por `settings`:

**Como ficará:**

```python
llm = ChatOpenAI(
    model=settings.CORPORATE_LLM_MODEL_NAME or "gpt-4o-mini",
    temperature=0,
    base_url=settings.CORPORATE_LLM_BASE_URL,
    api_key=settings.CORPORATE_LLM_API_KEY
)
```

### Passo 4: Tratamento de Certificados Corporativos (Atenção a Redes Internas)

Quando utilizamos um gateway self-hosted corporativo, é extremamente comum que as soluções de rede (como proxies HTTP ou firewalls) façam uso de **Certificados SSL CA Internos (Self-Signed)**.

Se isso ocorrer, a requisição disparada pelo `httpx` (camada base do Langchain) irá falhar com um erro de _SSL Certificate Verification Failed_.

**Plano de Mitigação (se necessário):**

- Adicionar o certificado CA corporativo ao container/máquina.
- Definir a variável de ambiente no sistema: `REQUESTS_CA_BUNDLE=/caminho/para/cert_corporativo.pem` ou `SSL_CERT_FILE`, garantindo que o chamador em Python confie no provider interno.

---

## 3. Considerações Alternativas (Edge Cases)

### A. E se o provedor for o **Azure OpenAI**?

Se a solução "self-hosted" ou gerenciada corporativa for baseada no ecossistema **Azure**, a classe `ChatOpenAI` não é a ideal, uma vez que a autenticação no Azure funciona via cabeçalhos diferentes (ex: `api-key`) e URLs baseadas em _deployments_.

- **O que muda no plano:** Teríamos que substituir o import `ChatOpenAI` pelo `AzureChatOpenAI` (na mesma biblioteca `langchain_openai`), utilizando parâmetros como `azure_endpoint` e `api_version`.

### B. Headers Customizados

Alguns gateways corporativos exigem a passagem de identificadores extras (tokens de gateway, ids de cobrança de centro de custo, client id interno, etc).

- **O que muda no plano:** Basta injetar esses cabeçalhos no dicionário de `default_headers` do próprio objeto `ChatOpenAI`:

```python
llm = ChatOpenAI(
    # ... outros parâmetros ...
    default_headers={
        "X-Corporate-Trace-Id": "audit-app",
        "Ocp-Apim-Subscription-Key": "sua-chave-aqui"
    }
)
```

## Resumo do Check-list para a Tarefa (quando for codificar)

1. [ ] Levantar com a equipe de infraestrutura corporativa a **URL**, **Chave de API**, se há **Certificado CA extra**, e se o proxy **100% simula o padrão OpenAI**.
2. [ ] Inserir os parâmetros no `.env` e no `config.py`.
3. [ ] Alterar a linha de instanciamento do `ChatOpenAI` no `nodes.py`.
4. [ ] Realizar um pequeno teste de requisição HTTP (curl) garantindo acessibilidade a partir da máquina/Docker onde roda o backend para o endpoint corporativo.
