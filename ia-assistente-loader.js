const express = require('express');
const { registrarRotaAssistente } = require('./ia-assistente');

if (!express.application.__gbmAssistenteLoaderInstalado) {
    const ouvirOriginal = express.application.listen;

    express.application.listen = function gbmListenComAssistente(...args) {
        registrarRotaAssistente(this);
        return ouvirOriginal.apply(this, args);
    };

    express.application.__gbmAssistenteLoaderInstalado = true;
}
