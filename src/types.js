/**
 * @typedef {"TXT"|"MX"|"A"|"AAAA"|"CNAME"} RecordType
 * @typedef {"spf"|"dkim"|"dmarc"} RecordTxtFormat
 * @typedef {"ENODATA"|"EFORMERR"|"ESERVFAIL"|"ENOTFOUND"|"ENOTIMP"|"EREFUSED"|"EBADQUERY"|"EBADNAME"
 *  |"EBADFAMILY"|"EBADRESP"|"ECONNREFUSED"|"ETIMEOUT"|"EEOF"|"EFILE"|"ENOMEM"|"EDESTRUCTION"|"EBADSTR"|"EBADFLAGS"
 *  |"ENONAME"|"EBADHINTS"|"ENOTINITIALIZED"|"ELOADIPHLPAPI"|"EADDRGETNETWORKPARAMS"|"ECANCELLED"} DnsErrorCodes
 *
 * @typedef {object} DnsChain
 * @property {number} nr chain index
 * @property {RecordType} type
 * @property {string} hostname queried hostname
 * @property {"valid"|"invalid"|DnsErrorCodes|string[]} result
 *
 * @typedef {object} DnsErrorInfo
 * @property {string} hostname
 * @property {RecordType} recordType
 * @property {string|{ [key in RecordType]?: string }} expectedValue
 * @property {Error|unknown} error
 * @property {DnsChain[]} chain
 *
 * @typedef {object} DkimKeys
 * @property {string} selector
 * @property {string} publicKey
 * @property {string} privateKey
 */

export {}
