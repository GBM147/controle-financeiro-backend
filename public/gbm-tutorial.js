(function () {
    'use strict';

    const PAGINAS = {
        'index.html': {
            titulo: 'Acesso ao GBM',
            passos: [
                {
                    alvo: null,
                    titulo: '👋 Bem-vindo ao GBM',
                    texto: 'Esta é a área de acesso. Aqui você pode entrar, criar uma conta, validar seu e-mail ou recuperar sua senha.'
                },
                {
                    alvo: '.logo',
                    titulo: '🛡️ Sua área financeira',
                    texto: 'Confirme sempre a marca GBM antes de informar seus dados de acesso.'
                },
                {
                    alvo: '#form-login',
                    titulo: '🔐 Entrar com segurança',
                    texto: 'Informe seu e-mail ou telefone e sua senha. Marque “Manter conectado” somente em um aparelho pessoal.'
                },
                {
                    alvo: '.signup-prompt',
                    titulo: '✨ Criar uma conta',
                    texto: 'Se ainda não possui cadastro, use o link de criação de conta e conclua a verificação enviada pelo GBM.'
                },
                {
                    alvo: '#btn-instalar-app',
                    titulo: '📱 Instalar como aplicativo',
                    texto: 'Quando disponível, este botão instala o GBM no celular ou computador para acesso mais rápido.'
                },
                {
                    alvo: null,
                    titulo: '✅ Tudo pronto',
                    texto: 'Você pode rever este tutorial pelo botão de ajuda no canto da tela.'
                }
            ]
        },
        'dashboard.html': {
            titulo: 'Dashboard',
            mostrarBotao: false,
            passos: [
                {
                    alvo: null,
                    titulo: '👋 Bem-vindo ao seu dashboard',
                    texto: 'Aqui você acompanha sua vida financeira, registra movimentações e acessa todas as ferramentas do GBM.'
                },
                {
                    alvo: '#filtro-conta-dashboard',
                    titulo: '🏦 Filtrar por conta',
                    texto: 'Escolha uma conta bancária específica ou mantenha “Todas” para visualizar o resultado consolidado.'
                },
                {
                    alvo: '.grid-cards',
                    titulo: '📊 Resumo financeiro',
                    texto: 'Os cartões mostram entradas, saídas, resultado do período e comparação com o mês anterior.'
                },
                {
                    alvo: '.insights-panel',
                    titulo: '💡 Pontos de atenção',
                    texto: 'O GBM analisa os dados atuais e destaca informações que merecem sua atenção.'
                },
                {
                    alvo: '.lancamento-rapido',
                    titulo: '✍️ Lançamento rápido',
                    texto: 'Registre manualmente uma receita ou despesa, escolhendo conta, descrição, categoria, valor e data.'
                },
                {
                    alvo: '#painel-limite',
                    titulo: '🚧 Limites de gastos',
                    texto: 'Defina quanto pretende gastar em cada categoria. Na página completa, você também escolhe vários percentuais de aviso.'
                },
                {
                    alvo: '#painel-categoria',
                    titulo: '🏷️ Categorias personalizadas',
                    texto: 'Crie categorias próprias para organizar as movimentações de acordo com sua realidade.'
                },
                {
                    alvo: '#painel-meta',
                    titulo: '🎯 Metas financeiras',
                    texto: 'Crie um objetivo de economia. As contribuições e o progresso são acompanhados na página de Metas.'
                },
                {
                    alvo: '#painel-exibicao',
                    titulo: '📈 Exibição dos dados',
                    texto: 'Alterne entre tabela e gráfico para analisar as transações da forma que preferir.'
                },
                {
                    alvo: '#card-ofx',
                    titulo: '📥 Importar extratos',
                    texto: 'Use a Central de Importações para revisar arquivos OFX ou PDF antes de confirmar os lançamentos.'
                },
                {
                    alvo: '#menu-btn',
                    titulo: '☰ Menu principal',
                    texto: 'Abra o menu para acessar contas, importações, calendário, limites, relatórios, metas, notificações e configurações.'
                },
                {
                    alvo: null,
                    titulo: '🎉 Dashboard apresentado',
                    texto: 'Para rever este passo a passo, abra o menu e escolha “Como usar o site”.'
                }
            ]
        },
        'contas.html': {
            titulo: 'Minhas contas',
            passos: [
                {
                    alvo: null,
                    titulo: '🏦 Organize suas contas',
                    texto: 'Cadastre cada banco ou carteira separadamente para impedir que movimentações de contas diferentes sejam misturadas.'
                },
                {
                    alvo: '#form-conta',
                    titulo: '➕ Adicionar ou editar',
                    texto: 'Informe um nome fácil de reconhecer, o banco e o tipo da conta. O mesmo formulário também é usado para editar.'
                },
                {
                    alvo: '#conta-nome',
                    titulo: '✏️ Nome personalizado',
                    texto: 'Use nomes como “Conta principal”, “Nubank pessoal” ou “Carteira” para identificar rapidamente.'
                },
                {
                    alvo: '#lista-contas',
                    titulo: '📋 Contas cadastradas',
                    texto: 'Aqui você encontra saldo, situação e ações de edição. Uma conta com movimentações exige atenção antes da exclusão.'
                },
                {
                    alvo: null,
                    titulo: '✅ Contas organizadas',
                    texto: 'Depois de cadastrar, selecione a conta correta nos lançamentos e nas importações.'
                }
            ]
        },
        'importacoes.html': {
            titulo: 'Central de importações',
            passos: [
                {
                    alvo: null,
                    titulo: '📥 Importe com segurança',
                    texto: 'Arquivos OFX e PDF passam por uma prévia antes de entrarem no dashboard.'
                },
                {
                    alvo: '#conta-importacao',
                    titulo: '🏦 Escolha a conta correta',
                    texto: 'Este passo é obrigatório: todas as transações confirmadas serão vinculadas à conta selecionada.'
                },
                {
                    alvo: '#arquivo-extrato',
                    titulo: '📄 Selecione o extrato',
                    texto: 'Escolha o arquivo fornecido pelo banco. O sistema aceita os formatos indicados na página.'
                },
                {
                    alvo: '#btn-analisar',
                    titulo: '🔎 Analisar primeiro',
                    texto: 'A análise identifica banco, quantidade, valores e possíveis duplicidades sem salvar as transações.'
                },
                {
                    alvo: '#secao-previa',
                    titulo: '✅ Revise a prévia',
                    texto: 'Confira descrições, datas, categorias e valores. Só use “Confirmar” quando as informações estiverem corretas.'
                },
                {
                    alvo: '#historico-importacoes',
                    titulo: '🕘 Histórico e desfazer',
                    texto: 'Consulte os lotes já processados e desfaça uma importação quando a opção estiver disponível.'
                },
                {
                    alvo: null,
                    titulo: '🎉 Importação apresentada',
                    texto: 'Sempre confira a conta e a prévia; isso evita lançamentos no lugar errado.'
                }
            ]
        },
        'calendario.html': {
            titulo: 'Calendário financeiro',
            passos: [
                {
                    alvo: null,
                    titulo: '📅 Antecipe seu mês',
                    texto: 'Cadastre receitas e despesas recorrentes para visualizar compromissos futuros.'
                },
                {
                    alvo: '#form-recorrencia',
                    titulo: '🔁 Nova recorrência',
                    texto: 'Informe descrição, valor, tipo, categoria, dia do mês, conta e período de validade.'
                },
                {
                    alvo: '#rec-conta',
                    titulo: '🏦 Conta da recorrência',
                    texto: 'Selecione a conta que receberá a movimentação quando ela for processada.'
                },
                {
                    alvo: '#lista-recorrencias',
                    titulo: '📋 Recorrências cadastradas',
                    texto: 'Acompanhe os registros ativos e remova os que não devem mais aparecer no planejamento.'
                },
                {
                    alvo: '.resumo-calendario',
                    titulo: '💰 Saldo previsto',
                    texto: 'Compare o saldo atual com a projeção depois das movimentações previstas para o mês.'
                },
                {
                    alvo: '#eventos-calendario',
                    titulo: '🗓️ Movimentações do mês',
                    texto: 'Veja os eventos ordenados por data e identifique o que já ocorreu ou ainda está previsto.'
                }
            ]
        },
        'Limite-de-Gastos.html': {
            titulo: 'Limite de gastos',
            passos: [
                {
                    alvo: null,
                    titulo: '🚧 Controle por categoria',
                    texto: 'Defina um teto mensal e receba avisos antes de ultrapassá-lo.'
                },
                {
                    alvo: '#nova-meta-cat',
                    titulo: '🏷️ Escolha a categoria',
                    texto: 'Cada categoria pode ter seu próprio limite e seus próprios percentuais de aviso.'
                },
                {
                    alvo: '#nova-meta-valor',
                    titulo: '💵 Informe o limite',
                    texto: 'Digite o valor máximo que pretende gastar nessa categoria durante o mês.'
                },
                {
                    alvo: '.campo-percentuais',
                    titulo: '🔔 Vários percentuais',
                    texto: 'Adicione quantos avisos precisar, como 50%, 70% e 90%. Não é necessário usar intervalos de dez em dez.'
                },
                {
                    alvo: '#form-limite',
                    titulo: '💾 Salvar configuração',
                    texto: 'Grave o limite depois de revisar categoria, valor e percentuais.'
                },
                {
                    alvo: '#editor-container',
                    titulo: '📊 Limites existentes',
                    texto: 'Acompanhe o consumo de cada categoria e altere configurações quando necessário.'
                }
            ]
        },
        'metas.html': {
            titulo: 'Metas financeiras',
            passos: [
                {
                    alvo: null,
                    titulo: '🎯 Transforme planos em metas',
                    texto: 'Use esta página para objetivos de economia, como viagem, reserva ou compra importante.'
                },
                {
                    alvo: '#form-objetivo',
                    titulo: '➕ Criar uma meta',
                    texto: 'Defina nome, valor desejado, valor inicial, prazo e cor de identificação.'
                },
                {
                    alvo: '#objetivo-inicial',
                    titulo: '💰 Valor já guardado',
                    texto: 'Se você já começou a economizar, informe o valor inicial para o progresso começar corretamente.'
                },
                {
                    alvo: '#lista-objetivos',
                    titulo: '📈 Acompanhar progresso',
                    texto: 'Os cartões mostram quanto já foi acumulado, quanto falta e o prazo de cada meta.'
                },
                {
                    alvo: '#lista-objetivos',
                    titulo: '➕ Registrar contribuições',
                    texto: 'Dentro de cada cartão, use a ação de contribuição sempre que separar mais dinheiro para o objetivo.'
                }
            ]
        },
        'notificacoes.html': {
            titulo: 'Notificações',
            passos: [
                {
                    alvo: null,
                    titulo: '🔔 Central de notificações',
                    texto: 'Aqui ficam avisos de limites, segurança e outras informações importantes da sua conta.'
                },
                {
                    alvo: '#filtro-status',
                    titulo: '🔎 Filtrar por situação',
                    texto: 'Mostre todas as notificações ou concentre-se apenas nas que ainda não foram lidas.'
                },
                {
                    alvo: '#filtro-tipo',
                    titulo: '🏷️ Filtrar por tipo',
                    texto: 'Use o tipo para encontrar rapidamente avisos de limite ou mensagens específicas.'
                },
                {
                    alvo: '#lista-notificacoes',
                    titulo: '📨 Seus avisos',
                    texto: 'Abra e acompanhe as notificações. Você também pode marcar todas como lidas.'
                },
                {
                    alvo: '.switch-row',
                    titulo: '⚙️ Preferências',
                    texto: 'Escolha receber avisos no site, por e-mail ou pelos dois canais.'
                },
                {
                    alvo: '#pref-inicio',
                    titulo: '🌙 Horário silencioso',
                    texto: 'Defina um período em que os e-mails de alerta devem aguardar.'
                }
            ]
        },
        'relatorio.html': {
            titulo: 'Relatório mensal',
            passos: [
                {
                    alvo: null,
                    titulo: '📊 Entenda o seu mês',
                    texto: 'O relatório reúne receitas, despesas e categorias de um período mensal.'
                },
                {
                    alvo: '.filtros',
                    titulo: '🗓️ Escolha o período',
                    texto: 'Selecione mês, ano e, se desejar, uma conta bancária específica.'
                },
                {
                    alvo: '.btn-gerar',
                    titulo: '⚙️ Gerar relatório',
                    texto: 'O relatório é calculado com os filtros atuais. Altere os filtros e gere novamente sempre que precisar.'
                },
                {
                    alvo: '#card-resultado',
                    titulo: '📋 Resultado detalhado',
                    texto: 'Confira totais, movimentações e categorias encontradas no mês.'
                },
                {
                    alvo: '.btn-pdf',
                    titulo: '⬇ Exportar em PDF',
                    texto: 'Quando o resultado estiver correto, gere o documento para guardar ou compartilhar.'
                }
            ]
        },
        'relatorio-avancado.html': {
            titulo: 'Relatório avançado',
            passos: [
                {
                    alvo: null,
                    titulo: '✨ Análise Premium',
                    texto: 'Combine datas, contas, categorias e tipos para criar uma visão personalizada.'
                },
                {
                    alvo: '#form-filtros',
                    titulo: '🔎 Filtros combinados',
                    texto: 'Defina o intervalo e refine por conta, categoria ou tipo de movimentação.'
                },
                {
                    alvo: '.resumo-grid',
                    titulo: '💰 Totais do período',
                    texto: 'Veja receitas, despesas e resultado calculados para os filtros escolhidos.'
                },
                {
                    alvo: '#grafico-categorias',
                    titulo: '📊 Despesas por categoria',
                    texto: 'Compare visualmente quais categorias mais pesaram no período.'
                },
                {
                    alvo: '#baixar-csv',
                    titulo: '⬇ Exportar dados',
                    texto: 'Baixe um CSV para trabalhar os resultados em uma planilha.'
                },
                {
                    alvo: '#tabela-transacoes',
                    titulo: '📋 Transações encontradas',
                    texto: 'Consulte a lista completa que compõe os totais e gráficos.'
                }
            ]
        },
        'comparativo.html': {
            titulo: 'Comparativo mensal',
            passos: [
                {
                    alvo: null,
                    titulo: '📆 Compare os meses',
                    texto: 'Identifique meses de maior gasto, melhores resultados e mudanças no comportamento financeiro.'
                },
                {
                    alvo: '.filtros',
                    titulo: '🗓️ Escolha o ano',
                    texto: 'Selecione o ano que deseja analisar e gere o comparativo.'
                },
                {
                    alvo: '#card-resultado',
                    titulo: '📋 Resumo anual',
                    texto: 'O resultado destaca diferenças entre meses e os principais pontos do período.'
                },
                {
                    alvo: '#graficoComparativo',
                    titulo: '📊 Evolução visual',
                    texto: 'Use o gráfico para comparar entradas, saídas e resultado ao longo do ano.'
                }
            ]
        },
        'assinatura.html': {
            titulo: 'Minha assinatura',
            passos: [
                {
                    alvo: null,
                    titulo: '🛡️ Gerencie seu plano',
                    texto: 'Consulte o plano atual, período de teste, situação do pagamento e recursos disponíveis.'
                },
                {
                    alvo: '#card-assinatura',
                    titulo: '📌 Situação da assinatura',
                    texto: 'Este cartão informa se o plano está ativo, em teste, cancelado ou aguardando alguma ação.'
                },
                {
                    alvo: '.planos-grid',
                    titulo: '⚖️ Compare os planos',
                    texto: 'Veja o que está incluído no Gratuito e no Premium antes de tomar uma decisão.'
                },
                {
                    alvo: '.btn-upgrade',
                    titulo: '🚀 Ativar Premium',
                    texto: 'Use este botão para iniciar o pagamento quando desejar liberar os recursos Premium.'
                },
                {
                    alvo: '.btn-cancelar-assinatura',
                    titulo: '🛑 Cancelamento',
                    texto: 'Quando houver assinatura recorrente, o cancelamento precisa ser confirmado pelo Mercado Pago para impedir novas cobranças.'
                }
            ]
        },
        'pagamento.html': {
            titulo: 'Ativar Premium',
            passos: [
                {
                    alvo: null,
                    titulo: '🚀 Ativação do Premium',
                    texto: 'Revise preço e benefícios antes de continuar para o pagamento.'
                },
                {
                    alvo: '.card',
                    titulo: '💳 Detalhes do plano',
                    texto: 'Confira o valor mensal e a lista de recursos liberados pelo Premium.'
                },
                {
                    alvo: '#banner-trial',
                    titulo: '⏳ Período de teste',
                    texto: 'Quando existir um teste ativo, esta área mostra as informações correspondentes.'
                },
                {
                    alvo: '#btn-action',
                    titulo: '🔒 Pagamento seguro',
                    texto: 'Ao continuar, você será direcionado ao ambiente de pagamento. Aguarde a confirmação antes de fechar.'
                },
                {
                    alvo: '#btn-gratis',
                    titulo: 'Plano Gratuito',
                    texto: 'Você pode continuar no plano gratuito usando esta opção, com as limitações apresentadas na assinatura.'
                }
            ]
        },
        'perfil.html': {
            titulo: 'Meu perfil',
            passos: [
                {
                    alvo: null,
                    titulo: '👤 Personalize seu perfil',
                    texto: 'Altere como sua conta aparece sem remover a marca GBM do cabeçalho.'
                },
                {
                    alvo: '#capa-perfil',
                    titulo: '🖼️ Imagem de capa',
                    texto: 'Escolha uma capa JPG, PNG ou WebP para personalizar o topo do perfil.'
                },
                {
                    alvo: '#foto-perfil',
                    titulo: '📷 Foto do usuário',
                    texto: 'A foto escolhida aparecerá separada do botão de menu e servirá como atalho para o perfil.'
                },
                {
                    alvo: '#nome-exibicao',
                    titulo: '✏️ Nome de exibição',
                    texto: 'Defina o nome que será mostrado no cabeçalho e em outras áreas da sua conta.'
                },
                {
                    alvo: '#btn-salvar',
                    titulo: '💾 Salvar alterações',
                    texto: 'Depois de revisar a prévia, grave as alterações para aplicá-las no site.'
                }
            ]
        },
        'configuracoes.html': {
            titulo: 'Configurações',
            passos: [
                {
                    alvo: null,
                    titulo: '⚙️ Central da sua conta',
                    texto: 'Encontre assinatura, atendimento, perfil, contas bancárias e privacidade em um só lugar.'
                },
                {
                    alvo: '.grade',
                    titulo: '🧭 Atalhos de configuração',
                    texto: 'Cada cartão leva diretamente à área correspondente.'
                },
                {
                    alvo: 'a[href="assinatura.html"]',
                    titulo: '🛡️ Minha assinatura',
                    texto: 'Consulte o plano, faça upgrade ou confirme o cancelamento de uma recorrência.'
                },
                {
                    alvo: 'a[href="perfil.html"]',
                    titulo: '👤 Perfil e aparência',
                    texto: 'Altere nome de exibição, foto e capa do seu perfil.'
                },
                {
                    alvo: 'a[href="privacidade.html"]',
                    titulo: '🔐 Privacidade e dados',
                    texto: 'Exporte dados, acompanhe a proteção das informações e registre seu consentimento.'
                },
                {
                    alvo: '.zona-perigo',
                    titulo: '⚠️ Zona de exclusão',
                    texto: 'A exclusão é definitiva. Informe a senha e a frase solicitada somente quando realmente quiser apagar toda a conta.'
                }
            ]
        },
        'privacidade.html': {
            titulo: 'Privacidade e dados',
            passos: [
                {
                    alvo: null,
                    titulo: '🔐 Controle seus dados',
                    texto: 'Acompanhe a proteção das informações, exporte uma cópia e gerencie seu consentimento.'
                },
                {
                    alvo: '#exportar',
                    titulo: '⬇ Exportar meus dados',
                    texto: 'Baixe um JSON com os dados vinculados à sua conta para consulta ou portabilidade.'
                },
                {
                    alvo: '#status-criptografia',
                    titulo: '🛡️ Proteção de informações',
                    texto: 'Este indicador confirma se a chave de proteção está ativa no servidor.'
                },
                {
                    alvo: '#consentimento',
                    titulo: '✅ Consentimento',
                    texto: 'Registre sua escolha sobre o tratamento necessário para o funcionamento do serviço.'
                },
                {
                    alvo: 'a[href="configuracoes.html#excluir-conta"]',
                    titulo: '⚠️ Exclusão definitiva',
                    texto: 'A exclusão é realizada na Zona de exclusão das Configurações e não pode ser desfeita.'
                }
            ]
        },
        'fale-conosco.html': {
            titulo: 'Fale conosco',
            passos: [
                {
                    alvo: null,
                    titulo: '💬 Entre em contato',
                    texto: 'Envie dúvidas, sugestões ou relate um problema relacionado à sua conta GBM.'
                },
                {
                    alvo: '#assunto',
                    titulo: '🏷️ Escolha o assunto',
                    texto: 'Selecione o tema mais próximo da sua solicitação para facilitar o atendimento.'
                },
                {
                    alvo: '#mensagem',
                    titulo: '✍️ Descreva com detalhes',
                    texto: 'Informe o que aconteceu, em qual página e qual resultado esperava. Não envie senha nem chaves secretas.'
                },
                {
                    alvo: '#btnSubmit',
                    titulo: '📨 Enviar solicitação',
                    texto: 'Revise a mensagem antes do envio. A confirmação aparecerá na própria página.'
                }
            ]
        }
    };

    const estado = {
        pagina: null,
        configuracao: null,
        passo: 0,
        alvo: null,
        aberto: false,
        elementos: {}
    };

    function obterPagina() {
        const arquivo = decodeURIComponent(
            window.location.pathname.split('/').pop() || 'index.html'
        );
        return arquivo || 'index.html';
    }

    function obterUsuario() {
        try {
            return localStorage.getItem('userIdAtual')
                || sessionStorage.getItem('userIdAtual')
                || 'visitante';
        } catch (_) {
            return 'visitante';
        }
    }

    function obterChave() {
        return `gbm_tutorial_v3_${obterUsuario()}_${estado.pagina}`;
    }

    function marcarVisto() {
        try {
            localStorage.setItem(obterChave(), 'sim');
        } catch (_) {}
    }

    function jaViu() {
        try {
            return localStorage.getItem(obterChave()) === 'sim';
        } catch (_) {
            return false;
        }
    }

    function elementoVisivel(elemento) {
        if (!elemento) return false;
        const estilo = window.getComputedStyle(elemento);
        const retangulo = elemento.getBoundingClientRect();
        return estilo.display !== 'none'
            && estilo.visibility !== 'hidden'
            && retangulo.width > 0
            && retangulo.height > 0;
    }

    function encontrarAlvo(alvo) {
        if (!alvo) return null;
        const seletores = Array.isArray(alvo) ? alvo : [alvo];
        for (const seletor of seletores) {
            const elemento = document.querySelector(seletor);
            if (elementoVisivel(elemento)) return elemento;
        }
        return null;
    }

    function criarInterface() {
        if (document.getElementById('gbm-tour-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'gbm-tour-overlay';
        overlay.hidden = true;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'gbm-tour-titulo');
        overlay.innerHTML = `
            <div class="gbm-tour-spotlight gbm-tour-sem-alvo" aria-hidden="true"></div>
            <section class="gbm-tour-caixa gbm-tour-centralizada" tabindex="-1">
                <div class="gbm-tour-topo">
                    <span class="gbm-tour-contador">Passo 1 de 1</span>
                    <button class="gbm-tour-fechar" type="button" aria-label="Fechar tutorial">×</button>
                </div>
                <div class="gbm-tour-progresso" aria-hidden="true"><span></span></div>
                <h2 id="gbm-tour-titulo"></h2>
                <p class="gbm-tour-texto"></p>
                <div class="gbm-tour-rodape">
                    <button class="gbm-tour-botao gbm-tour-secundario gbm-tour-pular" type="button">Encerrar tutorial</button>
                    <div class="gbm-tour-navegacao">
                        <button class="gbm-tour-botao gbm-tour-secundario gbm-tour-voltar" type="button">Voltar</button>
                        <button class="gbm-tour-botao gbm-tour-principal gbm-tour-avancar" type="button">Próximo</button>
                    </div>
                </div>
            </section>
        `;
        document.body.appendChild(overlay);

        estado.elementos = {
            overlay,
            spotlight: overlay.querySelector('.gbm-tour-spotlight'),
            caixa: overlay.querySelector('.gbm-tour-caixa'),
            contador: overlay.querySelector('.gbm-tour-contador'),
            progresso: overlay.querySelector('.gbm-tour-progresso > span'),
            titulo: overlay.querySelector('#gbm-tour-titulo'),
            texto: overlay.querySelector('.gbm-tour-texto'),
            fechar: overlay.querySelector('.gbm-tour-fechar'),
            pular: overlay.querySelector('.gbm-tour-pular'),
            voltar: overlay.querySelector('.gbm-tour-voltar'),
            avancar: overlay.querySelector('.gbm-tour-avancar')
        };

        estado.elementos.fechar.addEventListener('click', finalizar);
        estado.elementos.pular.addEventListener('click', finalizar);
        estado.elementos.voltar.addEventListener('click', voltar);
        estado.elementos.avancar.addEventListener('click', avancar);
    }

    function criarBotaoAjuda() {
        if (estado.configuracao.mostrarBotao === false) return;
        if (document.getElementById('gbm-tour-ajuda')) return;

        const botao = document.createElement('button');
        botao.id = 'gbm-tour-ajuda';
        botao.type = 'button';
        botao.title = `Como usar: ${estado.configuracao.titulo}`;
        botao.setAttribute('aria-label', `Abrir tutorial da página ${estado.configuracao.titulo}`);
        botao.innerHTML = `
            <span class="gbm-tour-ajuda-icone" aria-hidden="true">?</span>
            <span class="gbm-tour-ajuda-texto">Como usar esta página</span>
        `;
        botao.addEventListener('click', iniciar);
        document.body.appendChild(botao);
    }

    function posicionar() {
        if (!estado.aberto) return;
        const { spotlight, caixa } = estado.elementos;
        const alvo = estado.alvo;

        if (!elementoVisivel(alvo)) {
            estado.alvo = null;
            spotlight.classList.add('gbm-tour-sem-alvo');
            caixa.classList.add('gbm-tour-centralizada');
            caixa.style.cssText = '';
            return;
        }

        spotlight.classList.remove('gbm-tour-sem-alvo');
        caixa.classList.remove('gbm-tour-centralizada');
        caixa.style.transform = 'none';

        const margemAlvo = 7;
        const margemCaixa = 14;
        const borda = 12;
        const retangulo = alvo.getBoundingClientRect();
        const larguraJanela = window.innerWidth;
        const alturaJanela = window.innerHeight;

        spotlight.style.top = `${Math.max(3, retangulo.top - margemAlvo)}px`;
        spotlight.style.left = `${Math.max(3, retangulo.left - margemAlvo)}px`;
        spotlight.style.width = `${Math.min(
            larguraJanela - 6,
            retangulo.width + margemAlvo * 2
        )}px`;
        spotlight.style.height = `${Math.min(
            alturaJanela - 6,
            retangulo.height + margemAlvo * 2
        )}px`;

        if (larguraJanela <= 680) {
            const alturaCaixa = caixa.offsetHeight || Math.min(350, alturaJanela * 0.42);
            const centroAlvo = retangulo.top + retangulo.height / 2;
            const espacoAcima = retangulo.top;
            const espacoAbaixo = alturaJanela - retangulo.bottom;
            const caixaNoTopo =
                (espacoAcima >= alturaCaixa + margemCaixa && espacoAcima > espacoAbaixo) ||
                (espacoAbaixo < alturaCaixa + margemCaixa && centroAlvo >= alturaJanela / 2);

            caixa.style.left = '8px';
            caixa.style.right = '8px';
            caixa.style.top = caixaNoTopo ? '8px' : 'auto';
            caixa.style.bottom = caixaNoTopo
                ? 'auto'
                : 'max(8px, env(safe-area-inset-bottom))';
            return;
        }

        caixa.style.right = 'auto';
        caixa.style.bottom = 'auto';
        const larguraCaixa = caixa.offsetWidth || 390;
        const alturaCaixa = caixa.offsetHeight || 250;
        const espacoAbaixo = alturaJanela - retangulo.bottom;
        const espacoAcima = retangulo.top;
        let topo;

        if (espacoAbaixo >= alturaCaixa + margemCaixa) {
            topo = retangulo.bottom + margemCaixa;
        } else if (espacoAcima >= alturaCaixa + margemCaixa) {
            topo = retangulo.top - alturaCaixa - margemCaixa;
        } else {
            topo = Math.max(borda, alturaJanela - alturaCaixa - borda);
        }

        let esquerda = retangulo.left + retangulo.width / 2 - larguraCaixa / 2;
        esquerda = Math.max(
            borda,
            Math.min(esquerda, larguraJanela - larguraCaixa - borda)
        );
        topo = Math.max(
            borda,
            Math.min(topo, alturaJanela - alturaCaixa - borda)
        );

        caixa.style.top = `${topo}px`;
        caixa.style.left = `${esquerda}px`;
    }

    function mostrarPasso() {
        const passos = estado.configuracao.passos;
        const passo = passos[estado.passo];
        const { caixa, contador, progresso, titulo, texto, voltar, avancar } =
            estado.elementos;

        titulo.textContent = passo.titulo;
        texto.textContent = passo.texto;
        contador.textContent = `Passo ${estado.passo + 1} de ${passos.length}`;
        progresso.style.width = `${((estado.passo + 1) / passos.length) * 100}%`;
        voltar.hidden = estado.passo === 0;
        avancar.textContent =
            estado.passo === passos.length - 1 ? 'Concluir' : 'Próximo';

        document.body.classList.remove('gbm-tour-bloqueado');
        estado.alvo = encontrarAlvo(passo.alvo);

        if (estado.alvo) {
            estado.alvo.scrollIntoView({
                behavior: 'auto',
                block: 'center',
                inline: 'nearest'
            });
        }

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                document.body.classList.add('gbm-tour-bloqueado');
                posicionar();
                caixa.focus({ preventScroll: true });
            });
        });
    }

    function iniciar() {
        criarInterface();
        estado.passo = 0;
        estado.aberto = true;
        estado.elementos.overlay.hidden = false;
        mostrarPasso();
    }

    function finalizar() {
        if (!estado.elementos.overlay) return;
        estado.elementos.overlay.hidden = true;
        estado.aberto = false;
        estado.alvo = null;
        document.body.classList.remove('gbm-tour-bloqueado');
        marcarVisto();
        const ajuda = document.getElementById('gbm-tour-ajuda');
        if (ajuda) ajuda.focus();
    }

    function avancar() {
        if (estado.passo >= estado.configuracao.passos.length - 1) {
            finalizar();
            return;
        }
        estado.passo += 1;
        mostrarPasso();
    }

    function voltar() {
        if (estado.passo === 0) return;
        estado.passo -= 1;
        mostrarPasso();
    }

    function tratarTeclado(evento) {
        if (!estado.aberto) return;
        if (evento.key === 'Escape') {
            evento.preventDefault();
            finalizar();
        } else if (evento.key === 'ArrowRight') {
            evento.preventDefault();
            avancar();
        } else if (evento.key === 'ArrowLeft') {
            evento.preventDefault();
            voltar();
        }
    }

    function inicializar() {
        estado.pagina = obterPagina();
        estado.configuracao = PAGINAS[estado.pagina];
        if (!estado.configuracao) return;

        criarInterface();
        criarBotaoAjuda();
        document.addEventListener('keydown', tratarTeclado);
        window.addEventListener('resize', posicionar);

        if (!jaViu()) {
            window.setTimeout(iniciar, estado.pagina === 'dashboard.html' ? 1200 : 700);
        }
    }

    window.iniciarTutorial = iniciar;
    window.GBMTutorial = {
        iniciar,
        finalizar,
        reiniciar() {
            try {
                localStorage.removeItem(obterChave());
            } catch (_) {}
            iniciar();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
