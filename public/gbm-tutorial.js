(function () {
    'use strict';

    const VERSAO_TUTORIAL = '1.1.47';

    const PAGINAS = {
        'dashboard.html': {
            titulo: 'Dashboard',
            mostrarBotao: false,
            passos: [
                {
                    alvo: null,
                    titulo: 'Bem-vindo ao seu dashboard',
                    texto: 'Aqui você acompanha sua vida financeira, registra movimentações e acessa todas as ferramentas do GBM.'
                },
                {
                    alvo: '#filtro-conta-dashboard',
                    titulo: 'Filtrar por conta',
                    texto: 'Escolha uma conta bancária específica ou mantenha “Todas” para visualizar o resultado consolidado.'
                },
                {
                    alvo: '.grid-cards',
                    titulo: 'Resumo financeiro',
                    texto: 'Os cartões mostram entradas, saídas, resultado do período e comparação com o mês anterior.'
                },
                {
                    alvo: '.insights-panel',
                    titulo: 'Pontos de atenção',
                    texto: 'O GBM analisa os dados atuais e destaca informações que merecem sua atenção.'
                },
                {
                    alvo: '.lancamento-rapido',
                    titulo: 'Lançamento rápido',
                    texto: 'Registre manualmente uma receita ou despesa, escolhendo conta, descrição, categoria, valor e data.'
                },
                {
                    alvo: '#painel-limite',
                    titulo: 'Limites de gastos',
                    texto: 'Defina quanto pretende gastar em cada categoria. Na página completa, você também escolhe vários percentuais de aviso.'
                },
                {
                    alvo: '#painel-categoria',
                    titulo: 'Categorias personalizadas',
                    texto: 'Crie categorias próprias para organizar as movimentações de acordo com sua realidade.'
                },
                {
                    alvo: '#painel-meta',
                    titulo: 'Objetivos de poupança',
                    texto: 'Crie um objetivo de poupança. Ele só avança com contribuições manuais ou transações que você destinar explicitamente.'
                },
                {
                    alvo: '#painel-exibicao',
                    titulo: 'Exibição dos dados',
                    texto: 'Alterne entre tabela e gráfico para analisar as transações da forma que preferir.'
                },
                {
                    alvo: '#card-ofx',
                    titulo: 'Importar extratos',
                    texto: 'Use a Central de Importações para revisar arquivos OFX ou PDF antes de confirmar os lançamentos.'
                },
                {
                    alvo: '#menu-btn',
                    titulo: 'Menu principal',
                    texto: 'Abra o menu para acessar contas, importações, calendário, limites, relatórios, objetivos de poupança, notificações e configurações.'
                },
                {
                    alvo: null,
                    titulo: 'Dashboard apresentado',
                    texto: 'Para rever este passo a passo, abra o menu e escolha “Como usar o site”.'
                }
            ]
        },
        'contas.html': {
            titulo: 'Minhas contas',
            passos: [
                {
                    alvo: null,
                    titulo: 'Organize suas contas',
                    texto: 'Cadastre cada banco ou carteira separadamente para impedir que movimentações de contas diferentes sejam misturadas.'
                },
                {
                    alvo: '#form-conta',
                    titulo: 'Adicionar ou editar',
                    texto: 'Informe um nome fácil de reconhecer, o banco e o tipo da conta. O mesmo formulário também é usado para editar.'
                },
                {
                    alvo: '#conta-nome',
                    titulo: 'Nome personalizado',
                    texto: 'Use nomes como “Conta principal”, “Nubank pessoal” ou “Carteira” para identificar rapidamente.'
                },
                {
                    alvo: '#lista-contas',
                    titulo: 'Contas cadastradas',
                    texto: 'Aqui você encontra saldo, situação e ações de edição. Uma conta com movimentações exige atenção antes da exclusão.'
                },
                {
                    alvo: null,
                    titulo: 'Contas organizadas',
                    texto: 'Depois de cadastrar, selecione a conta correta nos lançamentos e nas importações.'
                }
            ]
        },
        'importacoes.html': {
            titulo: 'Central de importações',
            passos: [
                {
                    alvo: null,
                    titulo: 'Importe com segurança',
                    texto: 'Arquivos OFX e PDF passam por uma prévia antes de entrarem no dashboard.'
                },
                {
                    alvo: '#conta-importacao',
                    titulo: 'Escolha a conta correta',
                    texto: 'Este passo é obrigatório: todas as transações confirmadas serão vinculadas à conta selecionada.'
                },
                {
                    alvo: '#arquivo-extrato',
                    titulo: 'Selecione o extrato',
                    texto: 'Escolha o arquivo fornecido pelo banco. O sistema aceita os formatos indicados na página.'
                },
                {
                    alvo: '#btn-analisar',
                    titulo: 'Analisar primeiro',
                    texto: 'A análise identifica banco, quantidade, valores e possíveis duplicidades sem salvar as transações.'
                },
                {
                    alvo: ['#secao-previa:not([hidden])', '#btn-analisar'],
                    titulo: 'Revise a prévia',
                    texto: 'Depois de analisar o arquivo, confira descrições, datas, categorias e valores. Só use “Confirmar” quando as informações estiverem corretas.'
                },
                {
                    alvo: '#historico-importacoes',
                    titulo: 'Histórico e desfazer',
                    texto: 'Consulte os lotes já processados e desfaça uma importação quando a opção estiver disponível.'
                },
                {
                    alvo: null,
                    titulo: 'Importação apresentada',
                    texto: 'Sempre confira a conta e a prévia; isso evita lançamentos no lugar errado.'
                }
            ]
        },
        'calendario.html': {
            titulo: 'Calendário financeiro',
            passos: [
                {
                    alvo: null,
                    titulo: 'Antecipe seu mês',
                    texto: 'Cadastre receitas e despesas recorrentes para visualizar compromissos futuros.'
                },
                {
                    alvo: '#form-recorrencia',
                    titulo: 'Nova recorrência',
                    texto: 'Informe descrição, valor, tipo, categoria, dia do mês, conta e período de validade.'
                },
                {
                    alvo: '#rec-conta',
                    titulo: 'Conta da recorrência',
                    texto: 'Selecione a conta que receberá a movimentação quando ela for processada.'
                },
                {
                    alvo: '#lista-recorrencias',
                    titulo: 'Recorrências cadastradas',
                    texto: 'Acompanhe os registros ativos e remova os que não devem mais aparecer no planejamento.'
                },
                {
                    alvo: '.resumo-calendario',
                    titulo: 'Saldo previsto',
                    texto: 'Compare o saldo atual com a projeção depois das movimentações previstas para o mês.'
                },
                {
                    alvo: '#eventos-calendario',
                    titulo: 'Movimentações do mês',
                    texto: 'Veja os eventos ordenados por data e identifique o que já ocorreu ou ainda está previsto.'
                }
            ]
        },
        'limite-de-gastos.html': {
            titulo: 'Limite de gastos',
            passos: [
                {
                    alvo: null,
                    titulo: 'Controle por categoria',
                    texto: 'Defina um teto mensal e receba avisos antes de ultrapassá-lo.'
                },
                {
                    alvo: '#nova-meta-cat',
                    titulo: 'Escolha a categoria',
                    texto: 'Cada categoria pode ter seu próprio limite e seus próprios percentuais de aviso.'
                },
                {
                    alvo: '#nova-meta-valor',
                    titulo: 'Informe o limite',
                    texto: 'Digite o valor máximo que pretende gastar nessa categoria durante o mês.'
                },
                {
                    alvo: '.campo-percentuais',
                    titulo: 'Vários percentuais',
                    texto: 'Adicione quantos avisos precisar, como 50%, 70% e 90%. Não é necessário usar intervalos de dez em dez.'
                },
                {
                    alvo: '#form-limite',
                    titulo: 'Salvar configuração',
                    texto: 'Grave o limite depois de revisar categoria, valor e percentuais.'
                },
                {
                    alvo: '#editor-container',
                    titulo: 'Limites existentes',
                    texto: 'Acompanhe o consumo de cada categoria e altere configurações quando necessário.'
                }
            ]
        },
        'metas.html': {
            titulo: 'Objetivos de poupança',
            passos: [
                {
                    alvo: null,
                    titulo: 'Transforme planos em objetivos',
                    texto: 'Use esta página para objetivos de poupança, como viagem, reserva ou compra importante. Categorias apenas classificam movimentações.'
                },
                {
                    alvo: '#form-objetivo',
                    titulo: 'Criar um objetivo',
                    texto: 'Defina nome, valor desejado, valor inicial, prazo e cor de identificação.'
                },
                {
                    alvo: '#objetivo-inicial',
                    titulo: 'Valor já guardado',
                    texto: 'Se você já começou a economizar, informe o valor inicial para o progresso começar corretamente.'
                },
                {
                    alvo: ['.objetivo-card:first-child', '#lista-objetivos'],
                    titulo: 'Acompanhar progresso',
                    texto: 'Os cartões mostram quanto já foi acumulado, quanto falta e o prazo de cada objetivo.'
                },
                {
                    alvo: ['.objetivo-card:first-child', '#lista-objetivos'],
                    titulo: 'Registrar contribuições',
                    texto: 'Dentro de cada cartão, registre contribuições manuais. Você também pode destinar uma transação explicitamente pelo dashboard.'
                }
            ]
        },
        'notificacoes.html': {
            titulo: 'Notificações',
            passos: [
                {
                    alvo: null,
                    titulo: 'Central de notificações',
                    texto: 'Aqui ficam avisos de limites, segurança e outras informações importantes da sua conta.'
                },
                {
                    alvo: '#filtro-status',
                    titulo: 'Filtrar por situação',
                    texto: 'Mostre todas as notificações ou concentre-se apenas nas que ainda não foram lidas.'
                },
                {
                    alvo: '#filtro-tipo',
                    titulo: 'Filtrar por tipo',
                    texto: 'Use o tipo para encontrar rapidamente avisos de limite ou mensagens específicas.'
                },
                {
                    alvo: ['.notificacao:first-child', '#lista-notificacoes'],
                    titulo: 'Seus avisos',
                    texto: 'Abra e acompanhe as notificações. Você também pode marcar todas como lidas.'
                },
                {
                    alvo: '.switch-row',
                    titulo: 'Preferências',
                    texto: 'Escolha receber avisos no site, por e-mail ou pelos dois canais.'
                },
                {
                    alvo: '#pref-inicio',
                    titulo: 'Horário silencioso',
                    texto: 'Defina um período em que os e-mails de alerta devem aguardar.'
                }
            ]
        },
        'relatorio-avancado.html': {
            titulo: 'Relatório avançado',
            passos: [
                {
                    alvo: null,
                    titulo: 'Análise Premium',
                    texto: 'Combine datas, contas, categorias e tipos para criar uma visão personalizada.'
                },
                {
                    alvo: '#form-filtros',
                    titulo: 'Filtros combinados',
                    texto: 'Defina o intervalo e refine por conta, categoria ou tipo de movimentação.'
                },
                {
                    alvo: '.resumo-grid',
                    titulo: 'Totais do período',
                    texto: 'Veja receitas, despesas e resultado calculados para os filtros escolhidos.'
                },
                {
                    alvo: ['#grafico-categorias:not(:empty)', '.resumo-grid', '#form-filtros'],
                    titulo: 'Despesas por categoria',
                    texto: 'Compare visualmente quais categorias mais pesaram no período.'
                },
                {
                    alvo: ['#baixar-excel:not([hidden])', '#form-filtros'],
                    titulo: 'Exportar dados',
                    texto: 'Baixe o Excel para manter o relatório formatado. O CSV continua disponível para dados simples.'
                },
                {
                    alvo: ['#tabela-transacoes tr:first-child', '.table-wrap', '#form-filtros'],
                    titulo: 'Transações encontradas',
                    texto: 'Consulte a lista completa que compõe os totais e gráficos.'
                }
            ]
        },
        'comparativo.html': {
            titulo: 'Comparativo mensal',
            passos: [
                {
                    alvo: null,
                    titulo: 'Compare os meses',
                    texto: 'Identifique meses de maior gasto, melhores resultados e mudanças no comportamento financeiro.'
                },
                {
                    alvo: '.filtros',
                    titulo: 'Escolha o ano',
                    texto: 'Selecione o ano que deseja analisar e gere o comparativo.'
                },
                {
                    alvo: ['#card-resultado:not([hidden])', '.filtros'],
                    titulo: 'Resumo anual',
                    texto: 'O resultado destaca diferenças entre meses e os principais pontos do período.'
                },
                {
                    alvo: ['#graficoComparativo', '#card-resultado:not([hidden])', '.filtros'],
                    titulo: 'Evolução visual',
                    texto: 'Use o gráfico para comparar entradas, saídas e resultado ao longo do ano.'
                }
            ]
        },
        'assinatura.html': {
            titulo: 'Minha assinatura',
            passos: [
                {
                    alvo: null,
                    titulo: 'Gerencie seu plano',
                    texto: 'Consulte o plano atual, período de teste, situação do pagamento e recursos disponíveis.'
                },
                {
                    alvo: '#card-assinatura',
                    titulo: 'Situação da assinatura',
                    texto: 'Este cartão informa se o plano está ativo, em teste, cancelado ou aguardando alguma ação.'
                },
                {
                    alvo: ['.planos-grid', '#card-assinatura'],
                    titulo: 'Compare os planos',
                    texto: 'Veja o que está incluído no Gratuito e no Premium antes de tomar uma decisão.'
                },
                {
                    alvo: ['.btn-upgrade', '#card-assinatura'],
                    titulo: 'Ativar Premium',
                    texto: 'Use este botão para iniciar o pagamento quando desejar liberar os recursos Premium.'
                },
                {
                    alvo: ['.btn-cancelar-assinatura', '#card-assinatura'],
                    titulo: 'Cancelamento',
                    texto: 'Quando houver assinatura recorrente, o cancelamento precisa ser confirmado pelo Mercado Pago para impedir novas cobranças.'
                }
            ]
        },
        'perfil.html': {
            titulo: 'Meu perfil',
            passos: [
                {
                    alvo: null,
                    titulo: 'Personalize seu perfil',
                    texto: 'Altere como sua conta aparece sem remover a marca GBM do cabeçalho.'
                },
                {
                    alvo: '#capa-perfil',
                    titulo: 'Imagem de capa',
                    texto: 'Escolha uma capa JPG, PNG ou WebP para personalizar o topo do perfil.'
                },
                {
                    alvo: '#foto-perfil',
                    titulo: 'Foto do usuário',
                    texto: 'A foto escolhida aparecerá separada do botão de menu e servirá como atalho para o perfil.'
                },
                {
                    alvo: '#nome-exibicao',
                    titulo: 'Nome de exibição',
                    texto: 'Defina o nome que será mostrado no cabeçalho e em outras áreas da sua conta.'
                },
                {
                    alvo: '#btn-salvar',
                    titulo: 'Salvar alterações',
                    texto: 'Depois de revisar a prévia, grave as alterações para aplicá-las no site.'
                }
            ]
        },
        'privacidade.html': {
            titulo: 'Privacidade e dados',
            passos: [
                {
                    alvo: null,
                    titulo: 'Controle seus dados',
                    texto: 'Acompanhe a proteção das informações, exporte uma cópia e gerencie seu consentimento.'
                },
                {
                    alvo: '#exportar',
                    titulo: 'Exportar meus dados',
                    texto: 'Baixe um JSON com os dados vinculados à sua conta para consulta ou portabilidade.'
                },
                {
                    alvo: '#status-criptografia',
                    titulo: 'Proteção de informações',
                    texto: 'Este indicador confirma se a chave de proteção está ativa no servidor.'
                },
                {
                    alvo: '#consentimento',
                    titulo: 'Consentimento',
                    texto: 'Registre sua escolha sobre o tratamento necessário para o funcionamento do serviço.'
                },
                {
                    alvo: 'a[href="configuracoes.html"]',
                    titulo: 'Exclusão definitiva',
                    texto: 'A exclusão é realizada na Zona de exclusão das Configurações e não pode ser desfeita.'
                }
            ]
        },
        'fale-conosco.html': {
            titulo: 'Fale conosco',
            passos: [
                {
                    alvo: null,
                    titulo: 'Entre em contato',
                    texto: 'Envie dúvidas, sugestões ou relate um problema relacionado à sua conta GBM.'
                },
                {
                    alvo: '#assunto',
                    titulo: 'Escolha o assunto',
                    texto: 'Selecione o tema mais próximo da sua solicitação para facilitar o atendimento.'
                },
                {
                    alvo: '#mensagem',
                    titulo: 'Descreva com detalhes',
                    texto: 'Informe o que aconteceu, em qual página e qual resultado esperava. Não envie senha nem chaves secretas.'
                },
                {
                    alvo: '#btnSubmit',
                    titulo: 'Enviar solicitação',
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
        rolagem: null,
        quadroAnimacao: null,
        ultimoFoco: null,
        observadorAlvo: null,
        toqueY: null,
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

    function obterViewport() {
        const viewport = window.visualViewport;
        return {
            topo: viewport ? viewport.offsetTop : 0,
            esquerda: viewport ? viewport.offsetLeft : 0,
            largura: viewport ? viewport.width : window.innerWidth,
            altura: viewport ? viewport.height : window.innerHeight
        };
    }

    function obterTopoSeguro(viewport) {
        const margem = viewport.largura <= 680 ? 10 : 16;
        let topo = viewport.topo + margem + lerInset('top');

        document.querySelectorAll('header, .topbar').forEach((elemento) => {
            if (!elementoVisivel(elemento)) return;
            const estilo = window.getComputedStyle(elemento);
            if (!['fixed', 'sticky'].includes(estilo.position)) return;

            const retangulo = elemento.getBoundingClientRect();
            const encostaNoTopo = retangulo.top <= viewport.topo + margem + 2;
            if (encostaNoTopo && retangulo.bottom < viewport.topo + viewport.altura * 0.35) {
                topo = Math.max(topo, retangulo.bottom + margem);
            }
        });

        return topo;
    }

    function lerInset(lado) {
        const valor = window
            .getComputedStyle(document.documentElement)
            .getPropertyValue(`--gbm-tour-inset-${lado}`);
        const numero = parseFloat(valor);
        return Number.isFinite(numero) ? numero : 0;
    }

    // Mede a altura real que a caixa vai ocupar no celular, com limite e
    // rolagem interna, para que sempre sobre espaco visivel para o alvo.
    function medirCaixaMovel(caixa, viewport, borda) {
        const largura = Math.max(0, viewport.largura - borda * 2);
        const limite = Math.max(
            140,
            Math.min(360, Math.round(viewport.altura * 0.46))
        );
        const texto = caixa.querySelector('.gbm-tour-texto');
        const overflowAnterior = texto ? texto.style.overflow : '';

        caixa.style.width = `${largura}px`;
        caixa.style.maxHeight = 'none';
        if (texto) texto.style.overflow = 'visible';

        const bordas = Math.max(0, caixa.offsetHeight - caixa.clientHeight);
        const natural =
            (caixa.scrollHeight || caixa.offsetHeight || 240) + bordas;

        if (texto) {
            if (overflowAnterior) {
                texto.style.overflow = overflowAnterior;
            } else {
                texto.style.removeProperty('overflow');
            }
        }

        const altura = Math.max(140, Math.min(Math.ceil(natural), limite));
        caixa.style.maxHeight = `${altura}px`;
        return { largura, altura };
    }

    // Reserva de espaco (altura da caixa + margens) usada antes de rolar
    // o alvo, para que ele nao termine embaixo da caixa.
    function calcularReservaMovel() {
        const caixa = estado.elementos?.caixa;
        if (!caixa) return 0;

        const viewport = obterViewport();
        if (viewport.largura > 680) return 0;

        const anterior = {
            centralizada: caixa.classList.contains('gbm-tour-centralizada'),
            width: caixa.style.width,
            maxHeight: caixa.style.maxHeight
        };
        caixa.classList.remove('gbm-tour-centralizada');
        const { altura } = medirCaixaMovel(caixa, viewport, 8);
        if (anterior.centralizada) {
            caixa.classList.add('gbm-tour-centralizada');
            restaurarEstilo(caixa, 'width', anterior.width);
            restaurarEstilo(caixa, 'max-height', anterior.maxHeight);
        }

        return altura + 14 + 8 + lerInset('bottom');
    }

    function alinharAlvoNaAreaVisivel(alvo, espacoReservado = 0) {
        if (!elementoVisivel(alvo)) return;

        const viewport = obterViewport();
        alvo.scrollIntoView({
            behavior: 'auto',
            block: 'start',
            inline: 'nearest'
        });

        const retangulo = alvo.getBoundingClientRect();
        const topoSeguro = obterTopoSeguro(viewport);
        const baixoLivre = viewport.topo + viewport.altura - espacoReservado;
        const faixaLivre = Math.max(0, baixoLivre - topoSeguro);

        // Quando o alvo cabe na faixa livre, centraliza-o nela.
        // Quando nao cabe, encosta-o no topo da faixa.
        const sobra = Math.max(0, faixaLivre - retangulo.height);
        const alvoDesejado = topoSeguro + Math.min(sobra / 2, 24);
        const deslocamento = retangulo.top - alvoDesejado;

        if (Math.abs(deslocamento) > 1) {
            window.scrollBy({
                top: deslocamento,
                left: 0,
                behavior: 'auto'
            });
        }
    }

    function restaurarEstilo(elemento, propriedade, valor) {
        if (valor) {
            elemento.style.setProperty(propriedade, valor);
        } else {
            elemento.style.removeProperty(propriedade);
        }
    }

    function bloquearRolagem() {
        if (estado.rolagem) return;

        const html = document.documentElement;
        const body = document.body;
        const x = window.scrollX;
        const y = window.scrollY;

        estado.rolagem = {
            x,
            y,
            htmlOverflow: html.style.overflow,
            htmlOverscroll: html.style.overscrollBehavior,
            bodyPosition: body.style.position,
            bodyTop: body.style.top,
            bodyLeft: body.style.left,
            bodyRight: body.style.right,
            bodyWidth: body.style.width,
            bodyOverflow: body.style.overflow,
            bodyOverscroll: body.style.overscrollBehavior
        };

        html.classList.add('gbm-tour-bloqueado');
        body.classList.add('gbm-tour-bloqueado');
        html.style.overflow = 'hidden';
        html.style.overscrollBehavior = 'none';
        body.style.position = 'fixed';
        body.style.top = `-${y}px`;
        body.style.left = `-${x}px`;
        body.style.right = '0';
        body.style.width = '100%';
        body.style.overflow = 'hidden';
        body.style.overscrollBehavior = 'none';
    }

    function desbloquearRolagem() {
        if (!estado.rolagem) return;

        const html = document.documentElement;
        const body = document.body;
        const rolagem = estado.rolagem;
        estado.rolagem = null;

        html.classList.remove('gbm-tour-bloqueado');
        body.classList.remove('gbm-tour-bloqueado');
        restaurarEstilo(html, 'overflow', rolagem.htmlOverflow);
        restaurarEstilo(html, 'overscroll-behavior', rolagem.htmlOverscroll);
        restaurarEstilo(body, 'position', rolagem.bodyPosition);
        restaurarEstilo(body, 'top', rolagem.bodyTop);
        restaurarEstilo(body, 'left', rolagem.bodyLeft);
        restaurarEstilo(body, 'right', rolagem.bodyRight);
        restaurarEstilo(body, 'width', rolagem.bodyWidth);
        restaurarEstilo(body, 'overflow', rolagem.bodyOverflow);
        restaurarEstilo(body, 'overscroll-behavior', rolagem.bodyOverscroll);
        window.scrollTo(rolagem.x, rolagem.y);
    }

    function limparPosicaoCaixa(caixa) {
        ['top', 'right', 'bottom', 'left', 'width', 'max-height', 'transform']
            .forEach((propriedade) => caixa.style.removeProperty(propriedade));
    }

    function agendarPosicionamento() {
        if (!estado.aberto) return;
        if (estado.quadroAnimacao) {
            window.cancelAnimationFrame(estado.quadroAnimacao);
        }
        estado.quadroAnimacao = window.requestAnimationFrame(() => {
            estado.quadroAnimacao = null;
            posicionar();
        });
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
            rodape: overlay.querySelector('.gbm-tour-rodape'),
            fechar: overlay.querySelector('.gbm-tour-fechar'),
            pular: overlay.querySelector('.gbm-tour-pular'),
            voltar: overlay.querySelector('.gbm-tour-voltar'),
            avancar: overlay.querySelector('.gbm-tour-avancar')
        };

        estado.elementos.fechar.addEventListener('click', finalizar);
        estado.elementos.pular.addEventListener('click', finalizar);
        estado.elementos.voltar.addEventListener('click', voltar);
        estado.elementos.avancar.addEventListener('click', avancar);
        overlay.addEventListener('touchstart', (evento) => {
            estado.toqueY = evento.touches[0]?.clientY ?? null;
        }, { passive: true });
        // O elemento que rola pode ser o texto (celular) ou a propria caixa.
        const obterRolador = (alvoEvento) => {
            if (!alvoEvento || !alvoEvento.closest) return null;
            if (!alvoEvento.closest('.gbm-tour-caixa')) return null;
            const texto = alvoEvento.closest('.gbm-tour-texto');
            if (texto && texto.scrollHeight > texto.clientHeight + 1) return texto;
            return alvoEvento.closest('.gbm-tour-caixa');
        };
        overlay.addEventListener('touchmove', (evento) => {
            const rolador = obterRolador(evento.target);
            const toqueAtual = evento.touches[0]?.clientY;
            if (!rolador || toqueAtual == null) {
                evento.preventDefault();
                return;
            }

            const deslocamento = estado.toqueY == null
                ? 0
                : estado.toqueY - toqueAtual;
            const possuiRolagem = rolador.scrollHeight > rolador.clientHeight + 1;
            const chegouAoTopo = rolador.scrollTop <= 0 && deslocamento < 0;
            const chegouAoFim =
                rolador.scrollTop + rolador.clientHeight >= rolador.scrollHeight - 1
                && deslocamento > 0;

            if (!possuiRolagem || chegouAoTopo || chegouAoFim) {
                evento.preventDefault();
            }
            estado.toqueY = toqueAtual;
        }, { passive: false });
        overlay.addEventListener('touchend', () => {
            estado.toqueY = null;
        }, { passive: true });
        overlay.addEventListener('touchcancel', () => {
            estado.toqueY = null;
        }, { passive: true });
        overlay.addEventListener('wheel', (evento) => {
            const rolador = obterRolador(evento.target);
            if (!rolador) {
                evento.preventDefault();
                return;
            }

            const possuiRolagem = rolador.scrollHeight > rolador.clientHeight + 1;
            const chegouAoTopo = rolador.scrollTop <= 0 && evento.deltaY < 0;
            const chegouAoFim =
                rolador.scrollTop + rolador.clientHeight >= rolador.scrollHeight - 1
                && evento.deltaY > 0;

            if (!possuiRolagem || chegouAoTopo || chegouAoFim) {
                evento.preventDefault();
            }
        }, { passive: false });
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

    function atualizarServiceWorker() {
        if (!('serviceWorker' in navigator)) return;

        navigator.serviceWorker.register(
            `/sw.js?v=${encodeURIComponent(VERSAO_TUTORIAL)}`,
            {
                scope: '/',
                updateViaCache: 'none'
            }
        )
            .then((registro) => registro.update())
            .catch((erro) => {
                console.warn('Não foi possível atualizar o cache do GBM.', erro);
            });
    }

    function posicionar() {
        if (!estado.aberto) return;
        const { spotlight, caixa } = estado.elementos;
        const alvo = estado.alvo;

        if (!elementoVisivel(alvo)) {
            estado.alvo = null;
            spotlight.classList.add('gbm-tour-sem-alvo');
            caixa.classList.add('gbm-tour-centralizada');
            limparPosicaoCaixa(caixa);
            delete caixa.dataset.posicao;
            return;
        }

        spotlight.classList.remove('gbm-tour-sem-alvo');
        caixa.classList.remove('gbm-tour-centralizada');
        limparPosicaoCaixa(caixa);

        const margemAlvo = 7;
        const margemCaixa = 14;
        const viewport = obterViewport();
        const movel = viewport.largura <= 680;
        const borda = movel ? 8 : 10;
        const alturaMinima = movel ? 145 : 160;
        const larguraMinima = movel
            ? Math.max(0, viewport.largura - borda * 2)
            : 260;
        const retangulo = alvo.getBoundingClientRect();
        const viewportDireita = viewport.esquerda + viewport.largura;
        const viewportBaixo = viewport.topo + viewport.altura;
        const limitar = (valor, minimo, maximo) =>
            Math.max(minimo, Math.min(valor, maximo));

        // ---- Celular: a caixa vira um painel ancorado no topo ou no rodape.
        // Ela nunca cobre o alvo e o destaque nunca e abandonado.
        if (movel) {
            const insetTopo = lerInset('top');
            const insetBaixo = lerInset('bottom');
            const { largura: larguraCaixa, altura: alturaCaixa } =
                medirCaixaMovel(caixa, viewport, borda);
            const reserva = alturaCaixa + margemCaixa;
            const topoSeguro = obterTopoSeguro(viewport);
            const limiteBaixo = viewportBaixo - borda - insetBaixo;

            const faixas = [
                {
                    posicao: 'rodape',
                    topo: topoSeguro,
                    baixo: limiteBaixo - reserva
                },
                {
                    posicao: 'topo',
                    topo: viewport.topo + borda + insetTopo + reserva,
                    baixo: limiteBaixo
                }
            ];
            const visivelNaFaixa = (faixa) => Math.max(
                0,
                Math.min(retangulo.bottom, faixa.baixo)
                - Math.max(retangulo.top, faixa.topo)
            );
            const faixa = visivelNaFaixa(faixas[1]) > visivelNaFaixa(faixas[0]) + 8
                ? faixas[1]
                : faixas[0];

            const alturaUtil = Math.max(0, faixa.baixo - faixa.topo);
            if (alturaUtil < 24) {
                // Sem espaco algum para destacar: mostra so a caixa centralizada.
                spotlight.classList.add('gbm-tour-sem-alvo');
                caixa.classList.add('gbm-tour-centralizada');
                limparPosicaoCaixa(caixa);
                caixa.dataset.posicao = 'centro-sem-destaque';
                return;
            }

            const destaqueTopoMovel = limitar(
                retangulo.top - margemAlvo,
                faixa.topo,
                faixa.baixo - 8
            );
            const destaqueBaixoMovel = limitar(
                retangulo.bottom + margemAlvo,
                destaqueTopoMovel + 8,
                faixa.baixo
            );
            const destaqueEsquerdaMovel = limitar(
                retangulo.left - margemAlvo,
                viewport.esquerda + 3,
                viewportDireita - 12
            );
            const destaqueDireitaMovel = limitar(
                retangulo.right + margemAlvo,
                destaqueEsquerdaMovel + 8,
                viewportDireita - 3
            );

            spotlight.style.top = `${destaqueTopoMovel}px`;
            spotlight.style.left = `${destaqueEsquerdaMovel}px`;
            spotlight.style.width =
                `${destaqueDireitaMovel - destaqueEsquerdaMovel}px`;
            spotlight.style.height =
                `${destaqueBaixoMovel - destaqueTopoMovel}px`;

            caixa.style.width = `${larguraCaixa}px`;
            caixa.style.maxHeight = `${alturaCaixa}px`;
            caixa.style.left = `${viewport.esquerda + borda}px`;
            caixa.style.top = faixa.posicao === 'rodape'
                ? `${limiteBaixo - alturaCaixa}px`
                : `${viewport.topo + borda + insetTopo}px`;
            caixa.dataset.posicao = faixa.posicao;
            return;
        }


        const destaqueEsquerda = limitar(
            retangulo.left - margemAlvo,
            viewport.esquerda + 3,
            viewportDireita - 4
        );
        const destaqueTopo = limitar(
            retangulo.top - margemAlvo,
            viewport.topo + 3,
            viewportBaixo - 4
        );
        const destaqueDireita = limitar(
            retangulo.right + margemAlvo,
            destaqueEsquerda + 1,
            viewportDireita - 3
        );
        const destaqueBaixo = limitar(
            retangulo.bottom + margemAlvo,
            destaqueTopo + 1,
            viewportBaixo - 3
        );

        spotlight.style.top = `${destaqueTopo}px`;
        spotlight.style.left = `${destaqueEsquerda}px`;
        spotlight.style.width = `${destaqueDireita - destaqueEsquerda}px`;
        spotlight.style.height = `${destaqueBaixo - destaqueTopo}px`;

        caixa.style.width = movel
            ? `${Math.max(0, viewport.largura - borda * 2)}px`
            : `${Math.min(390, viewport.largura - borda * 2)}px`;
        caixa.style.maxHeight = `${Math.max(0, viewport.altura - borda * 2)}px`;

        const acrescimoBordas = Math.max(0, caixa.offsetHeight - caixa.clientHeight);
        const larguraNatural = Math.min(
            caixa.offsetWidth || 390,
            viewport.largura - borda * 2
        );
        const alturaNatural = Math.min(
            (caixa.scrollHeight || caixa.offsetHeight || 250) + acrescimoBordas,
            viewport.altura - borda * 2
        );
        const centroX = (destaqueEsquerda + destaqueDireita) / 2;
        const centroY = (destaqueTopo + destaqueBaixo) / 2;

        const regioesVerticais = [
            {
                posicao: 'baixo',
                esquerda: viewport.esquerda + borda,
                topo: destaqueBaixo + margemCaixa,
                direita: viewportDireita - borda,
                baixo: viewportBaixo - borda
            },
            {
                posicao: 'topo',
                esquerda: viewport.esquerda + borda,
                topo: viewport.topo + borda,
                direita: viewportDireita - borda,
                baixo: destaqueTopo - margemCaixa
            }
        ];
        const regioesLaterais = [
            {
                posicao: 'direita',
                esquerda: destaqueDireita + margemCaixa,
                topo: viewport.topo + borda,
                direita: viewportDireita - borda,
                baixo: viewportBaixo - borda
            },
            {
                posicao: 'esquerda',
                esquerda: viewport.esquerda + borda,
                topo: viewport.topo + borda,
                direita: destaqueEsquerda - margemCaixa,
                baixo: viewportBaixo - borda
            }
        ];
        const candidatos = (movel
            ? regioesVerticais
            : [...regioesVerticais, ...regioesLaterais])
            .map((regiao) => ({
                ...regiao,
                largura: Math.max(0, regiao.direita - regiao.esquerda),
                altura: Math.max(0, regiao.baixo - regiao.topo)
            }));

        const completos = candidatos.filter((regiao) =>
            regiao.largura >= larguraNatural && regiao.altura >= alturaNatural
        );
        let escolhido = completos[0] || candidatos
            .filter((regiao) =>
                regiao.largura >= larguraMinima && regiao.altura >= alturaMinima
            )
            .sort((a, b) => (b.largura * b.altura) - (a.largura * a.altura))[0];

        if (!escolhido) {
            spotlight.classList.add('gbm-tour-sem-alvo');
            caixa.classList.add('gbm-tour-centralizada');
            limparPosicaoCaixa(caixa);
            caixa.dataset.posicao = 'centro-sem-destaque';
            return;
        }

        caixa.style.width = `${Math.min(larguraNatural, escolhido.largura)}px`;
        caixa.style.maxHeight = `${escolhido.altura}px`;

        const larguraCaixa = Math.min(caixa.offsetWidth, escolhido.largura);
        const alturaCaixa = Math.min(caixa.offsetHeight, escolhido.altura);
        const maximoEsquerda = escolhido.direita - larguraCaixa;
        const maximoTopo = escolhido.baixo - alturaCaixa;
        let esquerda;
        let topo;

        if (escolhido.posicao === 'baixo') {
            esquerda = limitar(
                centroX - larguraCaixa / 2,
                escolhido.esquerda,
                maximoEsquerda
            );
            topo = escolhido.topo;
        } else if (escolhido.posicao === 'topo') {
            esquerda = limitar(
                centroX - larguraCaixa / 2,
                escolhido.esquerda,
                maximoEsquerda
            );
            topo = escolhido.baixo - alturaCaixa;
        } else if (escolhido.posicao === 'direita') {
            esquerda = escolhido.esquerda;
            topo = limitar(
                centroY - alturaCaixa / 2,
                escolhido.topo,
                maximoTopo
            );
        } else {
            esquerda = escolhido.direita - larguraCaixa;
            topo = limitar(
                centroY - alturaCaixa / 2,
                escolhido.topo,
                maximoTopo
            );
        }

        caixa.style.top = `${topo}px`;
        caixa.style.left = `${esquerda}px`;
        caixa.dataset.posicao = escolhido.posicao;

        const destaqueFinal = spotlight.getBoundingClientRect();
        const caixaFinal = caixa.getBoundingClientRect();
        const aindaSobrepoe = destaqueFinal.left < caixaFinal.right
            && destaqueFinal.right > caixaFinal.left
            && destaqueFinal.top < caixaFinal.bottom
            && destaqueFinal.bottom > caixaFinal.top;

        if (aindaSobrepoe) {
            spotlight.classList.add('gbm-tour-sem-alvo');
            caixa.classList.add('gbm-tour-centralizada');
            limparPosicaoCaixa(caixa);
            caixa.dataset.posicao = 'centro-sem-destaque';
        }
    }

    function mostrarPasso() {
        const passos = estado.configuracao.passos;
        const passo = passos[estado.passo];
        const { caixa, contador, progresso, titulo, texto, rodape, voltar, avancar } =
            estado.elementos;

        if (estado.quadroAnimacao) {
            window.cancelAnimationFrame(estado.quadroAnimacao);
            estado.quadroAnimacao = null;
        }
        if (estado.observadorAlvo) {
            estado.observadorAlvo.disconnect();
            estado.observadorAlvo = null;
        }
        desbloquearRolagem();

        titulo.textContent = passo.titulo;
        texto.textContent = passo.texto;
        contador.textContent =
            `Passo ${estado.passo + 1} de ${passos.length} · v${VERSAO_TUTORIAL}`;
        progresso.style.width = `${((estado.passo + 1) / passos.length) * 100}%`;
        voltar.hidden = estado.passo === 0;
        rodape.classList.toggle('gbm-tour-sem-voltar', estado.passo === 0);
        avancar.textContent =
            estado.passo === passos.length - 1 ? 'Concluir' : 'Próximo';

        estado.alvo = encontrarAlvo(passo.alvo);

        if (estado.alvo) {
            alinharAlvoNaAreaVisivel(estado.alvo, calcularReservaMovel());
        }

        bloquearRolagem();
        estado.quadroAnimacao = window.requestAnimationFrame(() => {
            estado.quadroAnimacao = window.requestAnimationFrame(() => {
                estado.quadroAnimacao = null;
                if (!estado.aberto) return;
                posicionar();
                caixa.focus({ preventScroll: true });

                if (estado.alvo && 'ResizeObserver' in window) {
                    estado.observadorAlvo = new ResizeObserver(agendarPosicionamento);
                    estado.observadorAlvo.observe(estado.alvo);
                    estado.observadorAlvo.observe(caixa);
                }
            });
        });
    }

    function iniciar() {
        if (estado.aberto) return;
        criarInterface();
        estado.ultimoFoco = document.activeElement;
        estado.passo = 0;
        estado.aberto = true;
        estado.elementos.overlay.hidden = false;
        marcarVisto();
        mostrarPasso();
    }

    function finalizar() {
        if (!estado.elementos.overlay) return;
        if (estado.quadroAnimacao) {
            window.cancelAnimationFrame(estado.quadroAnimacao);
            estado.quadroAnimacao = null;
        }
        if (estado.observadorAlvo) {
            estado.observadorAlvo.disconnect();
            estado.observadorAlvo = null;
        }
        estado.elementos.overlay.hidden = true;
        estado.aberto = false;
        estado.alvo = null;
        desbloquearRolagem();
        const ajuda = document.getElementById('gbm-tour-ajuda');
        if (ajuda) {
            ajuda.focus({ preventScroll: true });
        } else if (estado.ultimoFoco && estado.ultimoFoco.isConnected) {
            estado.ultimoFoco.focus({ preventScroll: true });
        }
        estado.ultimoFoco = null;
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
        } else if (evento.key === 'Tab') {
            const focaveis = [...estado.elementos.caixa.querySelectorAll(
                'button:not([hidden]):not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )];
            if (!focaveis.length) {
                evento.preventDefault();
                estado.elementos.caixa.focus({ preventScroll: true });
                return;
            }
            const primeiro = focaveis[0];
            const ultimo = focaveis[focaveis.length - 1];
            if (evento.shiftKey && document.activeElement === primeiro) {
                evento.preventDefault();
                ultimo.focus({ preventScroll: true });
            } else if (!evento.shiftKey && document.activeElement === ultimo) {
                evento.preventDefault();
                primeiro.focus({ preventScroll: true });
            }
        }
    }

    function inicializar() {
        estado.pagina = obterPagina();
        estado.configuracao = PAGINAS[estado.pagina];
        if (!estado.configuracao) return;

        atualizarServiceWorker();
        criarInterface();
        criarBotaoAjuda();
        document.addEventListener('keydown', tratarTeclado);
        window.addEventListener('resize', agendarPosicionamento);
        window.addEventListener('orientationchange', agendarPosicionamento);
        window.visualViewport?.addEventListener('resize', agendarPosicionamento);
        window.visualViewport?.addEventListener('scroll', agendarPosicionamento);
        window.addEventListener('pagehide', desbloquearRolagem);
        document.fonts?.ready.then(agendarPosicionamento).catch(() => {});

        if (!jaViu()) {
            window.setTimeout(() => {
                if (!jaViu() && !estado.aberto) iniciar();
            }, estado.pagina === 'dashboard.html' ? 1200 : 700);
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
