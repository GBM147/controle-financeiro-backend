        async function carregarStatus(){
            try{
                const dados=await gbmJson(await fetchApi('/privacidade/status'));
                document.getElementById('consentimento').checked=Boolean(dados.consentimento_privacidade_em);
                document.getElementById('data-consentimento').textContent=dados.consentimento_privacidade_em
                    ? `Consentimento registrado em ${new Date(dados.consentimento_privacidade_em).toLocaleString('pt-BR')}.`
                    : 'O consentimento ainda não foi registrado.';
                document.getElementById('data-termos').textContent=dados.termos_aceitos_em
                    ? `Versão ${dados.termos_versao || 'não identificada'} aceita em ${new Date(dados.termos_aceitos_em).toLocaleString('pt-BR')}.`
                    : 'O aceite dos Termos ainda não foi registrado nesta conta.';
                document.getElementById('status-criptografia').innerHTML=dados.criptografia_ativa
                    ? '<span class="pill green">Criptografia ativa</span>'
                    : '<span class="pill amber">Configuração pendente no Render</span>';
            }catch(erro){gbmToast(erro.message,'erro')}
        }
        document.getElementById('salvar-consentimento').addEventListener('click',async()=>{
            try{
                await gbmJson(await fetchApi('/privacidade/consentimento',{
                    method:'PUT',headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({aceito:document.getElementById('consentimento').checked})
                }));
                gbmToast('Escolha registrada.');carregarStatus();
            }catch(erro){gbmToast(erro.message,'erro')}
        });
        document.getElementById('exportar').addEventListener('click',async()=>{
            try{
                const resposta=await fetchApi('/minha-conta/exportar');
                if(!resposta.ok) throw new Error('Falha ao exportar.');
                const blob=await resposta.blob();const url=URL.createObjectURL(blob);
                const link=document.createElement('a');link.href=url;link.download='meus-dados-gbm.json';link.click();
                setTimeout(()=>URL.revokeObjectURL(url),1000);
            }catch(erro){gbmToast(erro.message,'erro')}
        });
        carregarStatus();
