        let relatorioAtual=null;
        let graficoRelatorio=null;
        let categoriasGraficoRelatorio=[];
        const hoje=new Date();const inicio=new Date(hoje.getFullYear(),hoje.getMonth(),1);
        document.getElementById('data-inicio').value=inicio.toISOString().slice(0,10);
        document.getElementById('data-fim').value=hoje.toISOString().slice(0,10);
        async function carregarFiltros(){
            const [contas,categorias]=await Promise.all([
                gbmJson(await fetchApi('/contas')),
                gbmJson(await fetchApi('/categorias'))
            ]);
            document.getElementById('filtro-conta').insertAdjacentHTML('beforeend',contas.map(c=>`<option value="${c.id}">${gbmEscapar(c.nome)}</option>`).join(''));
            const lista=categorias.todas||categorias||[];
            document.getElementById('filtro-categoria').insertAdjacentHTML('beforeend',lista.map(c=>`<option value="${gbmEscapar(c)}">${gbmEscapar(c)}</option>`).join(''));
        }
        document.getElementById('form-filtros').addEventListener('submit',async(e)=>{e.preventDefault();gerar()});
        async function gerar(){
            const p=new URLSearchParams({
                data_inicio:document.getElementById('data-inicio').value,
                data_fim:document.getElementById('data-fim').value,
                conta_id:document.getElementById('filtro-conta').value,
                categoria:document.getElementById('filtro-categoria').value,
                tipo:document.getElementById('filtro-tipo').value
            });
            try{
                const dados=await gbmJson(await fetchApi(`/relatorio-avancado?${p}`));
                dados.filtros_exportacao=filtrosAtivos();
                relatorioAtual=dados;
                renderizar();
            }catch(erro){
                if(erro.status===403){if(confirm('Este relatório é Premium. Deseja conhecer o plano?'))location.href='pagamento.html';return}
                gbmToast(erro.message,'erro');
            }
        }
        function renderizar(){
            document.getElementById('resultado').hidden=false;
            const r=relatorioAtual.resumo;
            document.getElementById('total-receitas').textContent=gbmMoeda(r.receitas);
            document.getElementById('total-despesas').textContent=gbmMoeda(r.despesas);
            document.getElementById('total-resultado').textContent=gbmMoeda(r.resultado);
            document.getElementById('total-resultado').className=Number(r.resultado)>=0?'positivo':'negativo';
            const categorias=Object.entries(r.por_categoria).sort((a,b)=>b[1]-a[1]);
            categoriasGraficoRelatorio=categorias.slice(0,10);
            renderizarGraficoCategorias();
            document.getElementById('tabela-transacoes').innerHTML=relatorioAtual.transacoes.length?`<table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Valor</th></tr></thead><tbody>${relatorioAtual.transacoes.map(t=>`<tr><td>${gbmData(t.data_transacao)}</td><td>${gbmEscapar(t.descricao)}</td><td>${gbmEscapar(t.categoria)}</td><td>${gbmEscapar(t.conta)}</td><td class="${(t.tipo ? t.tipo !== 'Receita' : Number(t.valor) < 0) ? 'negativo' : 'positivo'}">${gbmMoeda(t.valor)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Nenhuma transação encontrada.</div>';
        }

        function renderizarGraficoCategorias(){
            const canvas=document.getElementById('grafico-categorias');
            const vazio=document.getElementById('grafico-categorias-vazio');
            if(!canvas||!vazio)return;
            if(graficoRelatorio){graficoRelatorio.destroy();graficoRelatorio=null}

            const temDados=categoriasGraficoRelatorio.length>0;
            canvas.hidden=!temDados;
            vazio.hidden=temDados;
            if(!temDados)return;

            const tipo=document.getElementById('tipo-grafico-relatorio')?.value||'bar';
            const circular=tipo==='doughnut'||tipo==='polarArea';
            graficoRelatorio=new Chart(canvas.getContext('2d'),{
                type:tipo,
                data:{
                    labels:categoriasGraficoRelatorio.map(([nome])=>nome),
                    datasets:[GBMGraficos.tingir({
                        label:'Despesas',
                        data:categoriasGraficoRelatorio.map(([,valor])=>Number(valor)||0),
                        // Barras numa cor só (a categoria já está no eixo); rosca e área polar usam a paleta.
                        gbmTokens:circular
                            ?{backgroundColor:categoriasGraficoRelatorio.map((_,indice)=>`grafico-${(indice%6)+1}`),borderColor:'surface'}
                            :{backgroundColor:'accent'},
                        borderWidth:circular?2:0,
                        borderRadius:tipo==='bar'?4:0,
                        borderSkipped:false
                    })]
                },
                options:{
                    responsive:true,
                    maintainAspectRatio:false,
                    scales:circular?undefined:{
                        x:{grid:{display:false},border:{display:false}},
                        y:{beginAtZero:true,border:{display:false}}
                    },
                    plugins:{
                        legend:{display:circular,position:'bottom',labels:{padding:12}},
                        tooltip:{callbacks:{label:(context)=>`${context.label}: ${gbmMoeda(context.raw)}`}}
                    }
                }
            });
        }

        const NOMES_MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

        function dataLocal(valor){
            const [ano,mes,dia]=String(valor||'').split('-').map(Number);
            return new Date(ano,mes-1,dia,12,0,0);
        }

        function dataArquivo(data){
            return data.toLocaleDateString('pt-BR').replaceAll('/','-');
        }

        function periodoDoRelatorio(){
            const inicio=dataLocal(relatorioAtual?.data_inicio||document.getElementById('data-inicio').value);
            const fim=dataLocal(relatorioAtual?.data_fim||document.getElementById('data-fim').value);
            const mesmoMes=inicio.getFullYear()===fim.getFullYear()&&inicio.getMonth()===fim.getMonth();
            const rotulo=mesmoMes
                ?`${NOMES_MESES[inicio.getMonth()]} ${inicio.getFullYear()}`
                :`${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')}`;
            const arquivo=mesmoMes
                ?`${NOMES_MESES[inicio.getMonth()]} ${inicio.getFullYear()}`
                :`${dataArquivo(inicio)} a ${dataArquivo(fim)}`;
            return{rotulo,arquivo};
        }

        function moedaPdf(valor){
            return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Math.abs(Number(valor)||0));
        }

        function textoSelect(id){
            const select=document.getElementById(id);
            return select.options[select.selectedIndex]?.text||'';
        }

        function filtrosAtivos(){
            const filtros=[];
            if(document.getElementById('filtro-conta').value!=='todas')filtros.push(`Conta: ${textoSelect('filtro-conta')}`);
            if(document.getElementById('filtro-categoria').value!=='todas')filtros.push(`Categoria: ${textoSelect('filtro-categoria')}`);
            if(document.getElementById('filtro-tipo').value!=='todos')filtros.push(`Tipo: ${textoSelect('filtro-tipo')}`);
            return filtros;
        }

        function filtrosDoRelatorio(){
            return Array.isArray(relatorioAtual?.filtros_exportacao)
                ?relatorioAtual.filtros_exportacao
                :filtrosAtivos();
        }

        function valorAssinado(transacao){
            const valor=Math.abs(Number(transacao?.valor)||0);
            return String(transacao?.tipo||'').trim().toLowerCase()==='receita'?valor:(valor===0?0:-valor);
        }

        function dataExcel(valor){
            const partes=String(valor||'').slice(0,10).split('-').map(Number);
            if(partes.length!==3||partes.some(parte=>!Number.isInteger(parte)))return null;
            const [ano,mes,dia]=partes;
            const data=new Date(ano,mes-1,dia,12,0,0);
            if(data.getFullYear()!==ano||data.getMonth()!==mes-1||data.getDate()!==dia)return null;
            return data;
        }

        async function baixarExcel(){
            if(!relatorioAtual?.transacoes)return gbmToast('Gere o relatório antes de baixar.','erro');
            if(!window.ExcelJS?.Workbook)return gbmToast('Não foi possível carregar o ExcelJS. Verifique sua conexão e tente novamente.','erro');

            const botao=document.getElementById('baixar-excel');
            const textoOriginal=botao.textContent;
            let urlExcel='';
            botao.disabled=true;
            botao.textContent='Gerando Excel...';

            try{
                const workbook=new window.ExcelJS.Workbook();
                workbook.creator='Guardian of Budget & Money';
                workbook.subject='Relatório financeiro GBM';
                workbook.created=new Date();

                const worksheet=workbook.addWorksheet('Relatório',{
                    properties:{defaultRowHeight:19},
                    views:[{
                        state:'frozen',
                        ySplit:3,
                        topLeftCell:'A4',
                        activeCell:'A4',
                        showGridLines:false
                    }],
                    pageSetup:{
                        paperSize:9,
                        orientation:'landscape',
                        fitToPage:true,
                        fitToWidth:1,
                        fitToHeight:0,
                        showGridLines:false,
                        horizontalCentered:true,
                        margins:{left:.25,right:.25,top:.4,bottom:.4,header:.2,footer:.2}
                    }
                });

                worksheet.columns=[
                    {width:14},
                    {width:38},
                    {width:26},
                    {width:26},
                    {width:24},
                    {width:28}
                ];

                const cores={
                    navy:'FF0F1A2B',
                    verde:'FF2E8B57',
                    positivo:'FF108756',
                    vermelho:'FFD23737',
                    despesa:'FFEF4444',
                    branco:'FFFFFFFF',
                    mutado:'FFB0BEC5',
                    texto:'FF0F1A2B',
                    claro:'FFF4F7FA',
                    alternado:'FFF5F7FA',
                    borda:'FFD7DEE8'
                };
                const formatoMoedaNormal='"R$" #,##0.00;[Red]-"R$" #,##0.00;"R$" 0.00';
                const formatoMoedaAssinada='"+" "R$" #,##0.00;"-" "R$" #,##0.00;"R$" 0.00';
                const borda={
                    top:{style:'thin',color:{argb:cores.borda}},
                    left:{style:'thin',color:{argb:cores.borda}},
                    bottom:{style:'thin',color:{argb:cores.borda}},
                    right:{style:'thin',color:{argb:cores.borda}}
                };

                function estilizarFaixa(linha,inicioColuna,fimColuna,{fundo,fonte,alinhamento,comBorda=false}={}){
                    for(let coluna=inicioColuna;coluna<=fimColuna;coluna++){
                        const celula=worksheet.getRow(linha).getCell(coluna);
                        if(fundo)celula.fill={type:'pattern',pattern:'solid',fgColor:{argb:fundo}};
                        if(fonte)celula.font={...fonte};
                        if(alinhamento)celula.alignment={...alinhamento};
                        if(comBorda)celula.border=borda;
                    }
                }

                const periodo=periodoDoRelatorio();
                const filtros=filtrosDoRelatorio();

                worksheet.mergeCells('A1:F1');
                worksheet.mergeCells('A2:F2');
                worksheet.mergeCells('A3:F3');
                [1,2,3].forEach(linha=>estilizarFaixa(linha,1,6,{
                    fundo:cores.navy,
                    alinhamento:{vertical:'middle',wrapText:true}
                }));
                worksheet.getRow(1).height=27;
                worksheet.getRow(2).height=22;
                worksheet.getRow(3).height=19;
                worksheet.getCell('A1').value='GUARDIAN OF BUDGET & MONEY';
                worksheet.getCell('A1').font={name:'Arial',size:17,bold:true,color:{argb:cores.branco}};
                worksheet.getCell('A2').value=`Relatório financeiro - ${periodo.rotulo}`;
                worksheet.getCell('A2').font={name:'Arial',size:11,color:{argb:cores.mutado}};
                worksheet.getCell('A3').value=filtros.length?filtros.join('  |  '):'';
                worksheet.getCell('A3').font={name:'Arial',size:9,italic:true,color:{argb:cores.mutado}};

                const resumo=relatorioAtual.resumo||{};
                const cards=[
                    {inicio:1,fim:2,titulo:'RECEITAS',valor:Math.abs(Number(resumo.receitas)||0),cor:cores.positivo},
                    {inicio:3,fim:4,titulo:'DESPESAS',valor:Math.abs(Number(resumo.despesas)||0),cor:cores.despesa},
                    {inicio:5,fim:6,titulo:'RESULTADO',valor:Number(resumo.resultado)||0,cor:Number(resumo.resultado)>=0?cores.positivo:cores.despesa}
                ];
                cards.forEach(card=>{
                    if(card.inicio!==card.fim){
                        worksheet.mergeCells(5,card.inicio,5,card.fim);
                        worksheet.mergeCells(6,card.inicio,6,card.fim);
                    }
                    estilizarFaixa(5,card.inicio,card.fim,{
                        fundo:cores.claro,
                        fonte:{name:'Arial',size:9,bold:true,color:{argb:'FF505E70'}},
                        alinhamento:{vertical:'middle',wrapText:true},
                        comBorda:true
                    });
                    estilizarFaixa(6,card.inicio,card.fim,{
                        fundo:cores.claro,
                        fonte:{name:'Arial',size:12,bold:true,color:{argb:card.cor}},
                        alinhamento:{vertical:'middle',wrapText:true},
                        comBorda:true
                    });
                    const titulo=worksheet.getRow(5).getCell(card.inicio);
                    const valor=worksheet.getRow(6).getCell(card.inicio);
                    titulo.value=card.titulo;
                    valor.value=card.valor;
                    valor.numFmt=formatoMoedaNormal;
                });
                worksheet.getRow(5).height=20;
                worksheet.getRow(6).height=25;

                const categorias=Object.entries(resumo.por_categoria||{})
                    .filter(([,valor])=>Number.isFinite(Number(valor))&&Number(valor)>0)
                    .sort((a,b)=>Number(b[1])-Number(a[1]))
                    .slice(0,10);
                let linhaAtual=8;

                worksheet.mergeCells(`A${linhaAtual}:F${linhaAtual}`);
                estilizarFaixa(linhaAtual,1,6,{
                    fundo:cores.verde,
                    fonte:{name:'Arial',size:11,bold:true,color:{argb:cores.branco}},
                    alinhamento:{vertical:'middle'}
                });
                worksheet.getCell(`A${linhaAtual}`).value='Despesas por categoria';
                worksheet.getRow(linhaAtual).height=22;
                linhaAtual++;

                worksheet.mergeCells(`A${linhaAtual}:E${linhaAtual}`);
                estilizarFaixa(linhaAtual,1,6,{
                    fundo:cores.verde,
                    fonte:{name:'Arial',size:9,bold:true,color:{argb:cores.branco}},
                    alinhamento:{vertical:'middle',wrapText:true},
                    comBorda:true
                });
                worksheet.getCell(`A${linhaAtual}`).value='Categoria';
                worksheet.getCell(`F${linhaAtual}`).value='Valor';
                worksheet.getCell(`F${linhaAtual}`).alignment={horizontal:'right',vertical:'middle'};
                linhaAtual++;

                if(categorias.length){
                    categorias.forEach(([categoria,valor],indice)=>{
                        worksheet.mergeCells(`A${linhaAtual}:E${linhaAtual}`);
                        estilizarFaixa(linhaAtual,1,6,{
                            fundo:indice%2?cores.alternado:cores.branco,
                            fonte:{name:'Arial',size:9,color:{argb:cores.texto}},
                            alinhamento:{vertical:'middle',wrapText:true},
                            comBorda:true
                        });
                        worksheet.getCell(`A${linhaAtual}`).value=String(categoria||'Sem categoria');
                        worksheet.getCell(`F${linhaAtual}`).value=Math.abs(Number(valor)||0);
                        worksheet.getCell(`F${linhaAtual}`).numFmt=formatoMoedaNormal;
                        worksheet.getCell(`F${linhaAtual}`).font={name:'Arial',size:9,bold:true,color:{argb:cores.despesa}};
                        worksheet.getCell(`F${linhaAtual}`).alignment={horizontal:'right',vertical:'middle'};
                        linhaAtual++;
                    });
                }else{
                    worksheet.mergeCells(`A${linhaAtual}:F${linhaAtual}`);
                    estilizarFaixa(linhaAtual,1,6,{
                        fundo:cores.branco,
                        fonte:{name:'Arial',size:9,italic:true,color:{argb:'FF788494'}},
                        alinhamento:{vertical:'middle'},
                        comBorda:true
                    });
                    worksheet.getCell(`A${linhaAtual}`).value='Sem despesas no período.';
                    linhaAtual++;
                }

                linhaAtual++;
                worksheet.mergeCells(`A${linhaAtual}:F${linhaAtual}`);
                estilizarFaixa(linhaAtual,1,6,{
                    fundo:cores.navy,
                    fonte:{name:'Arial',size:11,bold:true,color:{argb:cores.branco}},
                    alinhamento:{vertical:'middle'}
                });
                worksheet.getCell(`A${linhaAtual}`).value='Transações';
                worksheet.getRow(linhaAtual).height=22;
                linhaAtual++;

                const linhaCabecalhoTransacoes=linhaAtual;
                ['Data','Descrição','Categoria','Conta','Valor'].forEach((titulo,indice)=>{
                    worksheet.getRow(linhaAtual).getCell(indice+1).value=titulo;
                });
                estilizarFaixa(linhaAtual,1,5,{
                    fundo:cores.navy,
                    fonte:{name:'Arial',size:9,bold:true,color:{argb:cores.branco}},
                    alinhamento:{vertical:'middle',wrapText:true},
                    comBorda:true
                });
                worksheet.getRow(linhaAtual).getCell(5).alignment={horizontal:'right',vertical:'middle'};
                linhaAtual++;

                const transacoes=Array.isArray(relatorioAtual.transacoes)?relatorioAtual.transacoes:[];
                transacoes.forEach((transacao,indice)=>{
                    const linha=worksheet.getRow(linhaAtual);
                    const data=dataExcel(transacao.data_transacao);
                    const valor=valorAssinado(transacao);
                    linha.getCell(1).value=data||gbmData(transacao.data_transacao);
                    if(data)linha.getCell(1).numFmt='dd/mm/yyyy';
                    linha.getCell(2).value=String(transacao.descricao||'');
                    linha.getCell(3).value=String(transacao.categoria||'');
                    linha.getCell(4).value=String(transacao.conta||'');
                    linha.getCell(5).value=valor;
                    linha.getCell(5).numFmt=formatoMoedaAssinada;
                    estilizarFaixa(linhaAtual,1,5,{
                        fundo:indice%2?cores.alternado:cores.branco,
                        fonte:{name:'Arial',size:9,color:{argb:cores.texto}},
                        alinhamento:{vertical:'middle',wrapText:true},
                        comBorda:true
                    });
                    linha.getCell(1).alignment={horizontal:'center',vertical:'middle'};
                    linha.getCell(5).alignment={horizontal:'right',vertical:'middle'};
                    linha.getCell(5).font={
                        name:'Arial',
                        size:9,
                        bold:true,
                        color:{argb:valor>=0?cores.positivo:cores.vermelho}
                    };
                    linhaAtual++;
                });

                const ultimaLinhaTransacao=transacoes.length?linhaAtual-1:linhaCabecalhoTransacoes;
                if(!transacoes.length){
                    worksheet.mergeCells(`A${linhaAtual}:E${linhaAtual}`);
                    estilizarFaixa(linhaAtual,1,5,{
                        fundo:cores.branco,
                        fonte:{name:'Arial',size:9,italic:true,color:{argb:'FF788494'}},
                        alinhamento:{vertical:'middle'},
                        comBorda:true
                    });
                    worksheet.getCell(`A${linhaAtual}`).value='Nenhuma transação encontrada.';
                    linhaAtual++;
                }

                worksheet.autoFilter=`A${linhaCabecalhoTransacoes}:E${ultimaLinhaTransacao}`;
                worksheet.pageSetup.printArea=`A1:F${linhaAtual-1}`;
                worksheet.pageSetup.printTitlesRow='1:3';

                const buffer=await workbook.xlsx.writeBuffer();
                const blob=new Blob([buffer],{
                    type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });
                urlExcel=URL.createObjectURL(blob);
                const link=document.createElement('a');
                link.href=urlExcel;
                link.download=`Relatório ${periodo.arquivo} - GBM.xlsx`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                gbmToast('Excel formatado gerado com sucesso.');
            }catch(erro){
                console.error('Falha ao gerar Excel:',erro);
                gbmToast('Não foi possível gerar o arquivo Excel. Tente novamente.','erro');
            }finally{
                if(urlExcel)setTimeout(()=>URL.revokeObjectURL(urlExcel),1000);
                botao.disabled=false;
                botao.textContent=textoOriginal;
            }
        }

        function baixarPDF(){
            if(!relatorioAtual?.transacoes)return gbmToast('Gere o relatório antes de baixar.','erro');
            if(!window.jspdf?.jsPDF)return gbmToast('Não foi possível carregar o gerador de PDF. Tente novamente.','erro');

            const {jsPDF}=window.jspdf;
            const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
            const periodo=periodoDoRelatorio();
            const resumo=relatorioAtual.resumo;
            const margem=12;
            const larguraPagina=doc.internal.pageSize.getWidth();

            doc.setFillColor(15,123,95);
            doc.rect(0,0,larguraPagina,29,'F');
            doc.setTextColor(255,255,255);
            doc.setFont('helvetica','bold');
            doc.setFontSize(18);
            doc.text('GUARDIAN OF BUDGET & MONEY',margem,12);
            doc.setFont('helvetica','normal');
            doc.setFontSize(11);
            doc.setTextColor(231,243,239);
            doc.text(`Relatório financeiro - ${periodo.rotulo}`,margem,21);

            const filtros=filtrosDoRelatorio();
            if(filtros.length){
                doc.setFontSize(8);
                doc.text(filtros.join('  |  '),larguraPagina-margem,21,{align:'right'});
            }

            const espacamentoCaixas=7;
            const larguraCaixa=(larguraPagina-(margem*2)-(espacamentoCaixas*2))/3;
            const caixas=[
                {x:margem,titulo:'RECEITAS',valor:resumo.receitas,cor:[21,128,61]},
                {x:margem+larguraCaixa+espacamentoCaixas,titulo:'DESPESAS',valor:resumo.despesas,cor:[180,35,24]},
                {x:margem+(larguraCaixa+espacamentoCaixas)*2,titulo:'RESULTADO',valor:resumo.resultado,cor:Number(resumo.resultado)>=0?[16,185,129]:[239,68,68]}
            ];
            caixas.forEach(caixa=>{
                doc.setFillColor(244,247,250);
                doc.roundedRect(caixa.x,35,larguraCaixa,18,2,2,'F');
                doc.setTextColor(80,94,112);
                doc.setFont('helvetica','bold');
                doc.setFontSize(8);
                doc.text(caixa.titulo,caixa.x+3,41);
                doc.setTextColor(...caixa.cor);
                doc.setFontSize(11);
                doc.text(moedaPdf(caixa.valor),caixa.x+3,49);
            });

            const categorias=Object.entries(resumo.por_categoria||{})
                .sort((a,b)=>Number(b[1])-Number(a[1]))
                .slice(0,10);

            let inicioTransacoes=62;
            if(categorias.length){
                doc.autoTable({
                    head:[['Despesas por categoria','Valor']],
                    body:categorias.map(([categoria,valor])=>[categoria,moedaPdf(valor)]),
                    startY:60,
                    margin:{left:margem,right:larguraPagina-margem-138},
                    theme:'grid',
                    styles:{fontSize:8,cellPadding:2.2},
                    headStyles:{fillColor:[15,123,95],textColor:[255,255,255],fontStyle:'bold'},
                    columnStyles:{1:{halign:'right',fontStyle:'bold'}}
                });
                inicioTransacoes=doc.lastAutoTable.finalY+8;
            }

            doc.setTextColor(28,28,26);
            doc.setFont('helvetica','bold');
            doc.setFontSize(12);
            doc.text('Transações',margem,inicioTransacoes-3);

            doc.autoTable({
                head:[['Data','Descrição','Categoria','Conta','Valor']],
                body:relatorioAtual.transacoes.map(t=>{
                    const receita=String(t.tipo).toLowerCase()==='receita';
                    return[
                        gbmData(t.data_transacao),
                        String(t.descricao||''),
                        String(t.categoria||''),
                        String(t.conta||''),
                        `${receita?'+':'-'} ${moedaPdf(t.valor)}`
                    ];
                }),
                startY:inicioTransacoes,
                margin:{top:14,left:margem,right:margem,bottom:13},
                theme:'striped',
                showHead:'everyPage',
                styles:{fontSize:8.8,cellPadding:2.6,overflow:'linebreak',valign:'middle'},
                headStyles:{fillColor:[15,123,95],textColor:[255,255,255],fontStyle:'bold',fontSize:9},
                alternateRowStyles:{fillColor:[250,250,248]},
                columnStyles:{
                    0:{cellWidth:23},
                    1:{cellWidth:120},
                    2:{cellWidth:55},
                    3:{cellWidth:40},
                    4:{cellWidth:34,halign:'right',fontStyle:'bold'}
                },
                didParseCell(dado){
                    if(dado.section!=='body')return;
                    if(dado.column.index===4){
                        dado.cell.styles.textColor=String(dado.cell.raw).startsWith('+')?[21,128,61]:[180,35,24];
                    }
                }
            });

            const paginas=doc.internal.getNumberOfPages();
            for(let pagina=1;pagina<=paginas;pagina++){
                doc.setPage(pagina);
                doc.setFont('helvetica','normal');
                doc.setFontSize(7.5);
                doc.setTextColor(120,132,148);
                doc.text('GBM - Relatório financeiro confidencial',margem,doc.internal.pageSize.getHeight()-6);
                doc.text(`Página ${pagina} de ${paginas}`,larguraPagina-margem,doc.internal.pageSize.getHeight()-6,{align:'right'});
            }

            doc.save(`Relatório ${periodo.arquivo} - GBM.pdf`);
        }

        document.getElementById('baixar-excel').addEventListener('click',baixarExcel);
        document.getElementById('baixar-pdf').addEventListener('click',baixarPDF);

        document.getElementById('baixar-csv').addEventListener('click',()=>{
            if(!relatorioAtual)return;
            const linhas=[
                ['Data','Descrição','Categoria','Conta','Valor'],
                ...relatorioAtual.transacoes.map(t=>[
                    gbmData(t.data_transacao),
                    t.descricao,
                    t.categoria,
                    t.conta,
                    valorAssinado(t).toFixed(2).replace('.',',')
                ])
            ];
            const escaparCsv=valor=>`"${String(valor??'').replaceAll('"','""')}"`;
            const csv='\uFEFFsep=;\r\n'+linhas.map((linha,indiceLinha)=>
                linha.map((valor,indiceColuna)=>
                    indiceLinha>0&&indiceColuna===4?String(valor):escaparCsv(valor)
                ).join(';')
            ).join('\r\n');
            const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`Relatório ${periodoDoRelatorio().arquivo} - GBM.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        });
        carregarFiltros().then(gerar).catch(e=>gbmToast(e.message,'erro'));
