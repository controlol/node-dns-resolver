/**
 * @typedef {import("./types.js").DnsErrorInfo} DnsErrorInfo
 */

/**
 * @typedef {Pick<DnsError, "hostname"|"recordType"|"expectedValue"|"chain"|"status"|"name"|"message">} DnsErrorData
 */

export class DnsError extends Error {
  /** @type {DnsErrorInfo["hostname"]} */
  hostname
  /** @type {DnsErrorInfo["recordType"]} */
  recordType
  /** @type {Exclude<DnsErrorInfo["expectedValue"], string>} */
  expectedValue
  /** @type {DnsErrorInfo["error"]} */
  originalError
  /** @type {DnsErrorInfo["chain"]} */
  chain
  /** @type {number} */
  status

  /**
   *
   * @param {string} message
   * @param {number} status
   * @param {DnsErrorInfo} info
   */
  constructor(message, status, info) {
    super(message)
    this.name = "DnsError"
    this.hostname = info.hostname
    this.recordType = info.recordType
    if (typeof info.expectedValue === "string") this.expectedValue = { [info.recordType]: info.expectedValue }
    else this.expectedValue = info.expectedValue
    this.originalError = info.error
    this.chain = info.chain
    this.status = status
  }

  /** @returns {DnsErrorData} */
  toObject = () => ({
    message: this.message,
    name: this.name,
    hostname: this.hostname,
    expectedValue: this.expectedValue,
    recordType: this.recordType,
    chain: this.chain,
    status: this.status,
  })
}
