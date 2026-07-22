#!/usr/bin/env python3
# =======================================================
# extrator_pdf.py — Lê um PDF de extrato bancário pela entrada padrão
# (stdin) e devolve pela saída padrão (stdout) o texto reconstruído,
# com o espaçamento das colunas preservado.
#
# Este script substitui o antigo Pdfrender.js: o contrato de saída é
# o mesmo (texto com colunas separadas por espaço, uma "linha visual"
# do extrato por linha de texto), então o Pdfextratoparser.js (Node)
# continua funcionando sem nenhuma mudança — só a origem do texto virou
# mais confiável, porque o pdfplumber lida muito melhor com agrupamento
# de palavras do que a extração manual por coordenada que fazíamos antes.
#
# Uso: python3 extrator_pdf.py < extrato.pdf > texto.txt
# =======================================================

import sys
import io
import pdfplumber

TOLERANCIA_Y = 3   # agrupa palavras na "mesma linha visual" da tabela
GAP_MINIMO = 2      # espaço horizontal mínimo (pt) pra considerar duas palavras em colunas diferentes


def reconstruir_pagina(pagina):
    """
    Agrupa as palavras da página por proximidade vertical (mesma linha
    visual) e depois as ordena da esquerda pra direita, preservando o
    espaçamento — equivalente ao que o Pdfrender.js fazia na unha com
    x/y do pdf-parse, mas usando a detecção de palavras do pdfplumber,
    que é bem mais precisa (não gruda nem quebra palavras à toa).
    """
    palavras = pagina.extract_words(use_text_flow=False, keep_blank_chars=False)
    if not palavras:
        return []

    linhas = []
    for palavra in sorted(palavras, key=lambda p: (p['top'], p['x0'])):
        linha = next((l for l in linhas if abs(l['y'] - palavra['top']) <= TOLERANCIA_Y), None)
        if linha is None:
            linhas.append({'y': palavra['top'], 'itens': [palavra]})
        else:
            linha['itens'].append(palavra)

    linhas.sort(key=lambda l: l['y'])

    texto_linhas = []
    for linha in linhas:
        itens = sorted(linha['itens'], key=lambda p: p['x0'])
        texto = ''
        x_fim_anterior = None
        for item in itens:
            if x_fim_anterior is not None and (item['x0'] - x_fim_anterior) > GAP_MINIMO:
                texto += ' '
            texto += item['text']
            x_fim_anterior = item['x1']
        texto_linhas.append(texto)

    return texto_linhas


def main():
    dados_pdf = sys.stdin.buffer.read()
    if not dados_pdf:
        sys.stderr.write('Nenhum dado recebido pela entrada padrão.\n')
        sys.exit(1)

    todas_as_linhas = []
    try:
        with pdfplumber.open(io.BytesIO(dados_pdf)) as pdf:
            for pagina in pdf.pages:
                todas_as_linhas.extend(reconstruir_pagina(pagina))
    except Exception as erro:
        sys.stderr.write(f'Falha ao processar o PDF: {erro}\n')
        sys.exit(1)

    sys.stdout.write('\n'.join(todas_as_linhas))


if __name__ == '__main__':
    main()
