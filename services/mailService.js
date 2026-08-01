import TcpSocket from 'react-native-tcp-socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { atob } from './base64';

const IMAP_HOST = 'imap.itu.edu.tr';
const IMAP_PORT = 993;

const STORAGE_KEYS = {
    MAIL_PASSWORD: 'itu_mail_password',
};

function decodeBytesWithCharset(input, charset = 'utf-8') {
    try {
        const cs = charset.toLowerCase();
        const isUtf8 = cs.includes('utf-8') || cs.includes('utf8');

        let bytes;
        if (input instanceof Uint8Array) {
            bytes = input;
        } else {
            bytes = new Uint8Array(input.length);
            for (let i = 0; i < input.length; i++) {
                bytes[i] = input.charCodeAt(i) & 0xff;
            }
        }

        if (isUtf8 && typeof TextDecoder !== 'undefined') {
            try {
                return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            } catch (e) {

            }
        }

        let result = '';
        let i = 0;
        while (i < bytes.length) {
            const b = bytes[i];
            if (isUtf8) {

                if (b < 128) { result += String.fromCharCode(b); i++; }
                else if (b >= 192 && b < 224) { result += String.fromCharCode(((b & 31) << 6) | (bytes[i + 1] & 63)); i += 2; }
                else if (b >= 224 && b < 240) { result += String.fromCharCode(((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)); i += 3; }
                else { result += '?'; i++; }
                continue;
            }

            if (b < 128) { result += String.fromCharCode(b); }
            else {
                if (b === 0xd0) result += 'Ğ';
                else if (b === 0xf0) result += 'ğ';
                else if (b === 0xdd) result += 'İ';
                else if (b === 0xfd) result += 'ı';
                else if (b === 0xde) result += 'Ş';
                else if (b === 0xfe) result += 'ş';
                else if (b === 0xc7) result += 'Ç';
                else if (b === 0xe7) result += 'ç';
                else if (b === 0xd6) result += 'Ö';
                else if (b === 0xf6) result += 'ö';
                else if (b === 0xdc) result += 'Ü';
                else if (b === 0xfc) result += 'ü';
                else if (b === 0x93) result += '“';
                else if (b === 0x94) result += '”';
                else if (b === 0x91) result += '‘';
                else if (b === 0x92) result += '’';
                else result += String.fromCharCode(b);
            }
            i++;
        }
        return result;
    } catch (e) {
        return raw;
    }
}

function decodeRfc2047(str) {
    if (!str) return '';

    const noWhitespaceStr = str.replace(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?[^?]+\?[BbQq]\?[^?]*\?=)/ig, '$1');

    return noWhitespaceStr.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/ig, (match, charset, encoding, text) => {
        try {
            if (encoding.toUpperCase() === 'B') {
                return decodeBase64Text(text, charset);
            } else if (encoding.toUpperCase() === 'Q') {
                const decoded = text
                    .replace(/_/g, ' ')
                    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
                        String.fromCharCode(parseInt(hex, 16))
                    );
                return decodeBytesWithCharset(decoded, charset);
            }
        } catch (e) {
            return text;
        }
        return text;
    });
}

function decodeBase64Text(b64, charset = 'utf-8') {
    try {
        const cleanB64 = b64.replace(/[^A-Za-z0-9+/]/g, '');
        const bytes = new Uint8Array(Math.floor((cleanB64.length * 3) / 4));
        let byteIdx = 0;
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

        for (let i = 0; i < cleanB64.length; i += 4) {
            const c1 = chars.indexOf(cleanB64[i]);
            const c2 = chars.indexOf(cleanB64[i + 1]);
            const c3 = chars.indexOf(cleanB64[i + 2]);
            const c4 = chars.indexOf(cleanB64[i + 3]);

            bytes[byteIdx++] = (c1 << 2) | (c2 >> 4);
            if (c3 !== -1) bytes[byteIdx++] = ((c2 & 15) << 4) | (c3 >> 2);
            if (c4 !== -1) bytes[byteIdx++] = ((c3 & 3) << 6) | c4;
        }

        return decodeBytesWithCharset(bytes, charset);
    } catch (e) {
        console.error('[MailService] Custom Base64 decode error:', e);
        return b64;
    }
}

class MailService {
    constructor() {
        this.socket = null;
        this.tagCounter = 0;
        this.buffer = '';
        this._resolve = null;
        this._reject = null;
        this._currentTag = null;
        this.isAuthenticated = false;
        this.isBusy = false;
    }

    async getSavedPassword() {
        try {
            return await AsyncStorage.getItem(STORAGE_KEYS.MAIL_PASSWORD);
        } catch (e) {
            return null;
        }
    }

    async savePassword(password) {
        await AsyncStorage.setItem(STORAGE_KEYS.MAIL_PASSWORD, password);
    }

    async clearPassword() {
        await AsyncStorage.removeItem(STORAGE_KEYS.MAIL_PASSWORD);
    }

    _nextTag() {
        this.tagCounter++;
        return `A${this.tagCounter}`;
    }

    _connect() {
        return new Promise((resolve, reject) => {
            this.tagCounter = 0;
            this.buffer = '';
            let resolved = false;

            console.log(`[MailService] Connecting to ${IMAP_HOST}:${IMAP_PORT} via TLS...`);

            const opts = {
                host: IMAP_HOST,
                port: IMAP_PORT,
                tls: true,
                tlsCheckValidity: false,
                servername: IMAP_HOST
            };
            console.log('[MailService] createConnection opts:', JSON.stringify(opts));

            if (TcpSocket.connectTLS) {
                this.socket = TcpSocket.connectTLS(opts, () => {
                    console.log('[MailService] TLS connect callback fired.');
                });
            } else {
                this.socket = TcpSocket.createConnection(opts, () => {
                    console.log('[MailService] TLS connect callback fired.');
                });
            }

            this.socket.on('connect', () => console.log('[MailService] EVENT: connect'));
            this.socket.on('drain', () => console.log('[MailService] EVENT: drain'));
            this.socket.on('end', () => console.log('[MailService] EVENT: end'));
            this.socket.on('timeout', () => console.log('[MailService] EVENT: timeout'));
            this.socket.on('ready', () => console.log('[MailService] EVENT: ready'));
            this.socket.on('lookup', (err, addr, fam, host) => console.log('[MailService] EVENT: lookup', addr, fam, host));

            const connectTimeout = setTimeout(() => {
                if (resolved) return;
                console.error('[MailService] Connection timeout after 15s — no data received.');
                try { if (this.socket) this.socket.destroy(); } catch (e) { }
                this.socket = null;
                reject(new Error('Connection timeout — sunucu yanıt vermedi.'));
            }, 15000);

            const onGreeting = (data) => {
                console.log('[MailService] EVENT: data fired! type:', typeof data, 'constructor:', data?.constructor?.name, 'length:', data?.length);
                let text = '';
                try {

                    text = typeof data === 'string' ? data : data.toString('latin1');
                } catch (e) {
                    console.log('[MailService] toString failed, trying String():', e.message);
                    text = String(data);
                }
                console.log('[MailService] Greeting text (first 300):', text.substring(0, 300));
                this.buffer += text;
                if (this.buffer.includes('* OK')) {
                    resolved = true;
                    clearTimeout(connectTimeout);
                    this.socket.removeListener('data', onGreeting);
                    this.buffer = '';
                    console.log('[MailService] Server greeting OK!');
                    this.socket.on('data', (d) => this._onData(d));
                    resolve();
                }
            };
            this.socket.on('data', onGreeting);

            this.socket.on('error', (err) => {
                if (resolved) {
                    if (this._reject) {
                        this._reject(err);
                        this._reject = null;
                        this._resolve = null;
                        this._currentTag = null;
                    }
                    return;
                }
                clearTimeout(connectTimeout);
                console.error('[MailService] Socket error:', err?.message || err);
                reject(err);
            });

            this.socket.on('close', (hadError) => {
                console.log('[MailService] Socket closed. hadError:', hadError);
                if (this._reject) {
                    this._reject(new Error('Socket closed abruptly'));
                    this._reject = null;
                    this._resolve = null;
                    this._currentTag = null;
                }
                this.socket = null;
                this.isAuthenticated = false;
                this.isBusy = false;
            });
        });
    }

    async _ensureConnection(email, password) {
        if (this.socket && this.isAuthenticated) {
            console.log('[MailService] Checking if existing connection is alive with NOOP...');
            try {
                await this._executeCommand('NOOP');
                console.log('[MailService] Reusing existing connection.');
                return;
            } catch (e) {
                console.log('[MailService] Existing connection is dead. Reconnecting...');
                await this._disconnect();
            }
        }

        if (this.socket) {
            await this._disconnect();
        }

        console.log('[MailService] Step 1: Connecting...');
        await this._connect();

        console.log('[MailService] Step 2: Logging in...');
        try {
            await this._executeCommand(`LOGIN "${email}" "${password}"`);
            this.isAuthenticated = true;
            console.log('[MailService] Step 2: Login successful!');
        } catch (e) {
            console.error('[MailService] Step 2: Login FAILED:', e.message?.substring(0, 300));
            await this._disconnect();
            throw new Error('Giriş başarısız. Şifreyi kontrol edin.');
        }

        console.log('[MailService] Step 3: Selecting INBOX...');
        await this._executeCommand('SELECT INBOX');
    }

    _onData(data) {

        const text = data.toString('latin1');
        this.buffer += text;
        console.log(`[MailService] _onData chunk received (${text.length} chars), buffer total: ${this.buffer.length}, waiting for tag: ${this._currentTag}`);

        if (!this._currentTag) {
            console.log('[MailService] No current tag, ignoring data.');
            return;
        }

        const okPattern = `${this._currentTag} OK`;
        const noPattern = `${this._currentTag} NO`;
        const badPattern = `${this._currentTag} BAD`;

        if (this.buffer.includes(okPattern) || this.buffer.includes(noPattern) || this.buffer.includes(badPattern)) {
            const fullResponse = this.buffer;
            this.buffer = '';

            if (fullResponse.includes(noPattern) || fullResponse.includes(badPattern)) {
                console.error(`[MailService] Command ${this._currentTag} FAILED. Response (first 500):`, fullResponse.substring(0, 500));
                if (this._reject) this._reject(new Error(fullResponse));
            } else {
                console.log(`[MailService] Command ${this._currentTag} OK. Response length: ${fullResponse.length}`);
            }

            if (fullResponse.includes(okPattern) && this._resolve) {
                this._resolve(fullResponse);
            }
            this._resolve = null;
            this._reject = null;
            this._currentTag = null;
        }
    }

    _sendCommand(command) {
        return new Promise((resolve, reject) => {
            const tag = this._nextTag();
            this._currentTag = tag;

            const timeoutId = setTimeout(() => {
                console.error(`[MailService] Command ${tag} timed out after 15 seconds.`);
                this._resolve = null;
                this._reject = null;
                this._currentTag = null;
                reject(new Error('Command timeout'));
            }, 15000);

            this._resolve = (res) => { clearTimeout(timeoutId); resolve(res); };
            this._reject = (err) => { clearTimeout(timeoutId); reject(err); };

            this.buffer = '';
            const sanitized = command.startsWith('LOGIN') ? 'LOGIN "***" "***"' : command;
            console.log(`[MailService] Sending: ${tag} ${sanitized}`);
            this.socket.write(`${tag} ${command}\r\n`);
        });
    }

    async _executeCommand(command) {

        while (this.isBusy) {
            await new Promise(r => setTimeout(r, 100));
        }
        this.isBusy = true;
        try {
            return await this._sendCommand(command);
        } finally {
            this.isBusy = false;
        }
    }

    _disconnect() {
        return new Promise((resolve) => {
            if (!this.socket) {
                this.isAuthenticated = false;
                this.isBusy = false;
                resolve();
                return;
            }
            try {
                const tag = this._nextTag();
                this._currentTag = tag;
                this._resolve = () => {
                    try { this.socket.destroy(); } catch (e) { }
                    this.socket = null;
                    this.isAuthenticated = false;
                    this.isBusy = false;
                    resolve();
                };
                this._reject = () => {
                    try { this.socket.destroy(); } catch (e) { }
                    this.socket = null;
                    this.isAuthenticated = false;
                    this.isBusy = false;
                    resolve();
                };
                this.socket.write(`${tag} LOGOUT\r\n`);

                setTimeout(() => {
                    try { if (this.socket) this.socket.destroy(); } catch (e) { }
                    this.socket = null;
                    this.isAuthenticated = false;
                    this.isBusy = false;
                    resolve();
                }, 3000);
            } catch (e) {
                try { if (this.socket) this.socket.destroy(); } catch (e2) { }
                this.socket = null;
                this.isAuthenticated = false;
                this.isBusy = false;
                resolve();
            }
        });
    }

    async fetchInbox(email, password, count = 50) {
        console.log(`[MailService] fetchInbox called for ${email}, count=${count}`);
        try {
            await this._ensureConnection(email, password);

            const selectResponse = await this._executeCommand('SELECT INBOX');
            const existsMatch = selectResponse.match(/\* (\d+) EXISTS/);
            const totalMessages = existsMatch ? parseInt(existsMatch[1], 10) : 0;
            console.log(`[MailService] Total messages in INBOX: ${totalMessages}`);

            if (totalMessages === 0) {
                console.log('[MailService] Inbox is empty.');
                return { success: true, emails: [], total: 0 };
            }

            const start = Math.max(1, totalMessages - count + 1);
            console.log(`[MailService] Fetching messages ${start}:${totalMessages}...`);
            const fetchResponse = await this._executeCommand(
                `FETCH ${start}:${totalMessages} (BODY.PEEK[HEADER.FIELDS (SUBJECT FROM DATE)])`
            );

            console.log('[MailService] Parsing response...');
            const emails = this._parseFetchResponse(fetchResponse, start, totalMessages);
            console.log(`[MailService] Parsed ${emails.length} emails.`);

            return { success: true, emails, total: totalMessages };
        } catch (error) {
            console.error('[MailService] fetchInbox CAUGHT ERROR:', error?.message, error);
            await this._disconnect();
            return { success: false, error: 'Bağlantı hatası: ' + (error.message || 'Bilinmeyen hata') };
        }
    }

    async fetchMailBody(email, password, seqNum) {
        try {
            await this._ensureConnection(email, password);

            const structureRes = await this._executeCommand(
                `FETCH ${seqNum} (BODY.PEEK[HEADER] BODYSTRUCTURE)`
            );

            const structMatch = structureRes.match(/BODYSTRUCTURE \((.*)\)(?:\r?\n|\))/i);
            let partIds = [];
            let attachments = [];
            if (structMatch) {
                const sExp = this._parseSExp(`(${structMatch[1]})`);
                partIds = this._extractTextPartIds(sExp);
                attachments = this._extractAttachmentInfo(sExp);
            }

            let body;
            if (partIds.length > 0) {

                console.log(`[MailService] Found text parts: ${partIds.join(', ')}. Fetching selectively...`);
                const fetchCmd = partIds.map(id => `BODY.PEEK[${id}.MIME] BODY.PEEK[${id}]`).join(' ');
                const partsRes = await this._executeCommand(`FETCH ${seqNum} (${fetchCmd})`);

                const topHeaders = this._extractImapLiteral(structureRes, 'BODY[HEADER]') || '';

                let dummyMime = topHeaders.trimEnd();
                dummyMime = dummyMime.replace(/(?:^|\r?\n)Content-Type:[^\r\n]+/gi, '');
                dummyMime += `\r\nContent-Type: multipart/mixed; boundary="dummy-smart-boundary"\r\n\r\n`;

                for (let i = 0; i < partIds.length; i++) {
                    const id = partIds[i];
                    const partMime = this._extractImapLiteral(partsRes, `BODY[${id}.MIME]`) || '';
                    const partBody = this._extractImapLiteral(partsRes, `BODY[${id}]`) || '';
                    if (partBody) {
                        dummyMime += `--dummy-smart-boundary\r\n${partMime}\r\n\r\n${partBody}\r\n`;
                    }
                }
                dummyMime += `--dummy-smart-boundary--`;

                body = this._extractAndDecode(dummyMime, true);
            } else {

                console.log(`[MailService] Single part or unrecognized structure. Fetching full body...`);
                const fetchResponse = await this._executeCommand(
                    `FETCH ${seqNum} (BODY.PEEK[HEADER] BODY.PEEK[TEXT])`
                );
                body = this._extractAndDecode(fetchResponse);
            }

            console.log(`[MailService] Found ${attachments.length} attachment(s).`);
            return { success: true, body, attachments };
        } catch (error) {
            console.error('[MailService] fetchMailBody error:', error);
            await this._disconnect();
            return { success: false, error: 'Mail içeriği alınamadı.' };
        }
    }

    async fetchAttachment(email, password, seqNum, attachment) {
        try {
            await this._ensureConnection(email, password);

            console.log(`[MailService] Downloading attachment: ${attachment.filename} (part ${attachment.partId})...`);
            const res = await this._executeCommand(
                `FETCH ${seqNum} (BODY.PEEK[${attachment.partId}])`
            );

            const rawData = this._extractImapLiteral(res, `BODY[${attachment.partId}]`);
            if (!rawData) {
                return { success: false, error: 'Ek içeriği alınamadı.' };
            }

            let base64Data;
            const encoding = (attachment.encoding || '').toLowerCase();

            if (encoding === 'base64') {

                base64Data = rawData.replace(/[\s\r\n]/g, '');
            } else {

                let bytes;
                if (encoding === 'quoted-printable') {
                    const decoded = rawData
                        .replace(/=\r?\n/g, '')
                        .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
                    bytes = decoded;
                } else {
                    bytes = rawData;
                }

                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                let result = '';
                for (let i = 0; i < bytes.length; i += 3) {
                    const b1 = bytes.charCodeAt(i) & 0xff;
                    const b2 = i + 1 < bytes.length ? bytes.charCodeAt(i + 1) & 0xff : 0;
                    const b3 = i + 2 < bytes.length ? bytes.charCodeAt(i + 2) & 0xff : 0;
                    result += chars[b1 >> 2];
                    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
                    result += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
                    result += i + 2 < bytes.length ? chars[b3 & 63] : '=';
                }
                base64Data = result;
            }

            console.log(`[MailService] Attachment downloaded: ${attachment.filename} (${base64Data.length} base64 chars)`);
            return { success: true, base64: base64Data };
        } catch (error) {
            console.error('[MailService] fetchAttachment error:', error);
            return { success: false, error: 'Ek indirilemedi.' };
        }
    }

    _parseFetchResponse(response, startSeq, endSeq) {
        const emails = [];

        const fetchBlocks = response.split(/\* (\d+) FETCH/);

        for (let i = 1; i < fetchBlocks.length; i += 2) {
            const seqNum = parseInt(fetchBlocks[i], 10);
            const block = fetchBlocks[i + 1];
            if (!block) continue;

            const headerMatch = block.match(/BODY\[HEADER\.FIELDS \(SUBJECT FROM DATE\)\] \{\d+\}\r?\n([\s\S]*?)\r?\n\r?\n/);
            const headers = headerMatch ? headerMatch[1] : '';

            const unfolded = headers.replace(/\r?\n[ \t]+/g, ' ');
            const subjectMatch = unfolded.match(/Subject:\s*(.*)/i);
            const fromMatch = unfolded.match(/From:\s*(.*)/i);
            const dateMatch = unfolded.match(/Date:\s*(.*)/i);

            const rawSubject = subjectMatch ? subjectMatch[1].trim() : '';
            const rawFrom = fromMatch ? fromMatch[1].trim() : '';

            const decodedSubject = decodeBytesWithCharset(rawSubject, 'iso-8859-9');
            const decodedFrom = decodeBytesWithCharset(rawFrom, 'iso-8859-9');

            const subject = rawSubject ? decodeRfc2047(decodedSubject) : '(Konu yok)';
            const from = rawFrom ? decodeRfc2047(decodedFrom) : '(Bilinmeyen)';
            const date = dateMatch ? dateMatch[1].trim() : '';

            const fromParsed = this._parseFromField(from);

            emails.push({
                id: seqNum,
                seqNum,
                subject,
                from: fromParsed.name,
                fromEmail: fromParsed.email,
                date: this._formatDate(date),
                rawDate: date,
                timestamp: this._getTimestamp(date),
                read: true,
                body: ''
            });
        }

        return emails.sort((a, b) => b.timestamp - a.timestamp);
    }

    _extractAndDecode(response, isDummyMime = false) {
        let dummyMime = response;
        if (!isDummyMime) {
            const headers = this._extractImapLiteral(response, 'BODY[HEADER]') || '';
            const text = this._extractImapLiteral(response, 'BODY[TEXT]') || '';
            if (!text && !headers) {
                return 'Mail içeriği alınamadı.';
            }
            dummyMime = headers + '\r\n\r\n' + text;
        }

        const rootNode = this._extractNodes(dummyMime, 'utf-8');
        const rendered = this._renderTree(rootNode);

        return rendered.text || 'Mail içeriği alınamadı veya desteklenmeyen format.';
    }

    _extractNodes(mimeString, parentCharset) {
        let headerEnd = mimeString.indexOf('\r\n\r\n');
        let bodyStartOffset = 4;
        if (headerEnd === -1) {
            headerEnd = mimeString.indexOf('\n\n');
            bodyStartOffset = 2;
        }

        if (headerEnd === -1) {
            return { type: 'text/plain', headers: '', body: mimeString, charset: parentCharset };
        }

        const headers = mimeString.substring(0, headerEnd);
        const body = mimeString.substring(headerEnd + bodyStartOffset);

        const unfoldedHeaders = headers.replace(/\r?\n[ \t]+/g, ' ');

        const charsetMatch = unfoldedHeaders.match(/(?:^|\r?\n)Content-Type:.*charset="?([^"\s;\r\n]+)"?/i);
        const charset = charsetMatch ? charsetMatch[1] : parentCharset;

        const contentTypeMatch = unfoldedHeaders.match(/(?:^|\r?\n)Content-Type:\s*([^;\s\r\n]+)/i);
        const contentType = contentTypeMatch ? contentTypeMatch[1].toLowerCase() : 'text/plain';

        if (contentType.startsWith('multipart/')) {
            const boundaryMatch = unfoldedHeaders.match(/(?:^|\r?\n)Content-Type:.*boundary="?([^"\r\n]+)"?/i);
            if (!boundaryMatch) return { type: 'text/plain', headers, body, charset };

            const boundary = boundaryMatch[1];
            const parts = body.split('--' + boundary);

            const children = [];
            for (let part of parts) {
                if (!part || part.trim() === '' || part.trim() === '--') continue;

                if (part.startsWith('\r\n')) part = part.substring(2);
                else if (part.startsWith('\n')) part = part.substring(1);

                const childNode = this._extractNodes(part, charset);
                if (childNode) children.push(childNode);
            }
            return { type: contentType, children };
        }

        return { type: contentType, headers, body, charset };
    }

    _hasHtml(node) {
        if (!node) return false;
        if (node.type === 'text/html') return true;
        if (node.children) {
            for (const c of node.children) {
                if (this._hasHtml(c)) return true;
            }
        }
        return false;
    }

    _renderTree(node, forceHtml = false) {
        if (!node) return { text: '', isHtml: false };

        if (node.type === 'multipart/alternative') {
            let htmlNode = node.children.find(c => c.type === 'text/html' || (c.type.startsWith('multipart/') && this._hasHtml(c)));
            let textNode = node.children.find(c => c.type === 'text/plain');

            let chosen = htmlNode || textNode || node.children[0];
            return this._renderTree(chosen, forceHtml);
        }

        if (node.type.startsWith('multipart/')) {

            let out = '';
            let hasHtml = this._hasHtml(node);
            for (const child of node.children) {
                const rendered = this._renderTree(child, hasHtml);
                if (rendered.text) {
                    out += rendered.text + (hasHtml ? '<br/><br/>' : '\n\n');
                }
            }
            return { text: out, isHtml: hasHtml };
        }

        if (node.type === 'text/html') {
            const decoded = this._decodePart(node.headers, node.body, node.charset);
            return { text: decoded, isHtml: true };
        }

        if (node.type === 'text/plain') {
            let decoded = this._decodePart(node.headers, node.body, node.charset);
            if (forceHtml) {

                decoded = decoded.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
            }
            return { text: decoded, isHtml: forceHtml };
        }

        return { text: '', isHtml: false };
    }

    _decodePart(partHeaders, partBody, nodeCharset) {
        const charset = nodeCharset || 'utf-8';

        const unfoldedHeaders = partHeaders.replace(/\r?\n[ \t]+/g, ' ');

        const encodingMatch = unfoldedHeaders.match(/(?:^|\r?\n)Content-Transfer-Encoding:\s*([^\s;]+)/i);
        const encoding = encodingMatch ? encodingMatch[1].toLowerCase() : '';

        let content = partBody.replace(/--[^\r\n]*--\s*$/, '').trim();

        const cleanContentForCheck = content.replace(/[\s\r\n]/g, '');
        const isBase64Fallback = !encoding &&
            /^[A-Za-z0-9+/=]+$/.test(cleanContentForCheck) &&
            cleanContentForCheck.length > 50;

        if (encoding === 'base64' || isBase64Fallback) {
            return decodeBase64Text(content, charset);
        }
        if (encoding === 'quoted-printable') {
            return this._decodeQuotedPrintable(content, charset);
        }

        return decodeBytesWithCharset(content, charset);
    }

    _decodeQuotedPrintable(str, charset = 'utf-8') {
        const decoded = str
            .replace(/=\r?\n/g, '')
            .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
                String.fromCharCode(parseInt(hex, 16))
            );
        return decodeBytesWithCharset(decoded, charset);
    }

    _parseFromField(from) {

        const match = from.match(/"?([^"<]*)"?\s*<?([^>]*)>?/);
        if (match) {
            const name = match[1].trim() || match[2].trim();
            const email = match[2].trim() || from.trim();
            return { name, email };
        }
        return { name: from, email: from };
    }

    _getTimestamp(dateStr) {
        if (!dateStr) return 0;

        let d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.getTime();

        let cleanDate = dateStr.replace(/\([A-Za-z0-9\s]+\)/g, '').trim();
        d = new Date(cleanDate);
        if (!isNaN(d.getTime())) return d.getTime();
        d = new Date(cleanDate.replace(/([+-]\d{4})$/, 'GMT$1'));
        if (!isNaN(d.getTime())) return d.getTime();

        return 0;
    }

    _formatDate(dateStr) {
        if (!dateStr) return '';
        const ts = this._getTimestamp(dateStr);
        if (ts === 0) return dateStr;

        const d = new Date(ts);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = d.toDateString() === yesterday.toDateString();

        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');

        if (isToday) return `${hours}:${mins}`;
        if (isYesterday) return `Dün ${hours}:${mins}`;

        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        return `${day}.${month} ${hours}:${mins}`;
    }

    _extractImapLiteral(response, key) {
        const escapedKey = key.replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\./g, '\\.');
        const regex = new RegExp(`${escapedKey} \\{(\\d+)\\}\\r?\\n`);
        const match = response.match(regex);
        if (match) {
            const len = parseInt(match[1], 10);
            const start = match.index + match[0].length;
            return response.substring(start, start + len);
        }
        return null;
    }

    _parseSExp(str) {
        let pos = 0;
        function parse() {
            while (pos < str.length && str[pos] === ' ') pos++;
            if (pos >= str.length) return null;
            if (str[pos] === '(') {
                pos++;
                let list = [];
                while (pos < str.length && str[pos] !== ')') {
                    list.push(parse());
                    while (pos < str.length && str[pos] === ' ') pos++;
                }
                pos++;
                return list;
            } else if (str[pos] === '"') {
                pos++;
                let res = '';
                while (pos < str.length && str[pos] !== '"') {
                    if (str[pos] === '\\') { pos++; res += str[pos]; }
                    else { res += str[pos]; }
                    pos++;
                }
                pos++;
                return res;
            } else {
                let res = '';
                while (pos < str.length && !' ()"'.includes(str[pos])) {
                    res += str[pos];
                    pos++;
                }
                if (res.toUpperCase() === 'NIL') return null;
                return res;
            }
        }
        return parse();
    }

    _extractTextPartIds(node, prefix = '') {
        if (Array.isArray(node)) {
            if (Array.isArray(node[0])) {
                let ids = [];
                let partIndex = 1;
                for (let i = 0; i < node.length; i++) {
                    if (Array.isArray(node[i])) {
                        let newPrefix = prefix ? `${prefix}.${partIndex}` : `${partIndex}`;
                        ids = ids.concat(this._extractTextPartIds(node[i], newPrefix));
                        partIndex++;
                    } else {
                        break;
                    }
                }
                return ids;
            } else {
                const type = (node[0] || '').toLowerCase();
                const subtype = (node[1] || '').toLowerCase();
                if (type === 'text' && (subtype === 'plain' || subtype === 'html')) {
                    if (prefix === '') return [];
                    return [prefix];
                }
                return [];
            }
        }
        return [];
    }

    _extractAttachmentInfo(node, prefix = '') {
        if (!Array.isArray(node)) return [];
        if (Array.isArray(node[0])) {
            let attachments = [];
            let partIndex = 1;
            for (let i = 0; i < node.length; i++) {
                if (Array.isArray(node[i])) {
                    const newPrefix = prefix ? `${prefix}.${partIndex}` : `${partIndex}`;
                    attachments = attachments.concat(this._extractAttachmentInfo(node[i], newPrefix));
                    partIndex++;
                } else {
                    break;
                }
            }
            return attachments;
        }
        const type = (node[0] || '').toLowerCase();
        const subtype = (node[1] || '').toLowerCase();
        const mimeType = `${type}/${subtype}`;
        if (type === 'text' && (subtype === 'plain' || subtype === 'html')) {
            return [];
        }

        if (prefix === '') return [];

        const encoding = (node[5] || '').toLowerCase();

        const size = parseInt(node[6], 10) || 0;

        let filename = this._findParamValue(node[2], 'name');

        let isInline = false;
        for (let i = 7; i < node.length; i++) {
            if (Array.isArray(node[i])) {
                const dispType = (typeof node[i][0] === 'string') ? node[i][0].toLowerCase() : '';
                if (dispType === 'inline') {
                    isInline = true;
                }
                if (dispType === 'attachment' || dispType === 'inline') {
                    const dispFilename = this._findParamValue(node[i][1], 'filename');
                    if (dispFilename) filename = dispFilename;
                }
            }
        }

        if (isInline && type === 'image') {

            return [];
        }

        if (filename) {
            filename = decodeRfc2047(filename);
        }

        if (!filename && type === 'text') return [];
        if (!filename) {
            filename = `ek_${prefix}.${subtype || 'bin'}`;
        }

        return [{
            partId: prefix,
            filename,
            mimeType,
            encoding,
            size,
        }];
    }

    _findParamValue(params, key) {
        if (!Array.isArray(params)) return null;
        const lowerKey = key.toLowerCase();
        for (let i = 0; i < params.length - 1; i += 2) {
            if (typeof params[i] === 'string' && params[i].toLowerCase() === lowerKey) {
                return params[i + 1];
            }
        }
        return null;
    }
}

const mailService = new MailService();
export default mailService;
