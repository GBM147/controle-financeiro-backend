// Reconstrói o texto do PDF preservando o espaçamento entre colunas
// (o pdf-parse, por padrão, gruda colunas vizinhas sem espaço)
function renderComEspacamento(pageData) {
    const renderOptions = { normalizeWhitespace: false, disableCombineTextItems: false };
    return pageData.getTextContent(renderOptions).then(textContent => {
        const itens = textContent.items
            .filter(it => it.str.trim().length > 0)
            .map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 }))
            .sort((a, b) => b.y - a.y || a.x - b.x);

        const TOLERANCIA_Y = 4; // agrupa itens que estão na "mesma linha visual" da tabela
        const linhas = [];
        for (const item of itens) {
            let linha = linhas.find(l => Math.abs(l.y - item.y) <= TOLERANCIA_Y);
            if (!linha) {
                linha = { y: item.y, itens: [] };
                linhas.push(linha);
            }
            linha.itens.push(item);
        }
        linhas.sort((a, b) => b.y - a.y);

        let texto = '';
        for (const linha of linhas) {
            linha.itens.sort((a, b) => a.x - b.x);
            let linhaTexto = '';
            let xFimAnterior = null;
            for (const item of linha.itens) {
                if (xFimAnterior !== null && (item.x - xFimAnterior) > 2) {
                    linhaTexto += ' ';
                }
                linhaTexto += item.str;
                xFimAnterior = item.x + item.w;
            }
            texto += linhaTexto + '\n';
        }
        return texto;
    });
}
module.exports = { renderComEspacamento };
