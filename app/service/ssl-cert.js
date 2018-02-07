import { pki, md } from 'node-forge'
import { readFileSync, writeFileSync } from 'fs'

export function main () {
  IPC.answer('gen-ssl-cert', (domain) => {
    let { cert, key } = generateCert(domain, getMiddleCertPair)
    return {
      cert,
      key
    }
  })
}

const domainSuffix = {}

export function certDomain (domain) {
  return domain
  if (!domainSuffix['*']) {
    domainSuffix['*'] = true
    readAssets('domain-suffix.txt').toString().split('\n').forEach(v => {
      if (v) {
        domainSuffix[`${v.trim()}`] = true
      }
    })
  }
  const domainParts = domain.split('.')
  if (domainParts.length <= 2) {
    return domain
  }
  let certDomain = domainParts.slice(1).join('.')
  if (domainSuffix[certDomain]) {
    certDomain = domain
  } else {
    certDomain = `*.${certDomain}`
  }
  return certDomain
}

const rootCaFile = userDir('ca.json')

let rootPair = null
export function getRootCertPair () {
  if (!rootPair) {
    const { cer, key, time, hash } = JSON.parse(readFileSync(rootCaFile).toString())
    const rootCA = pki.certificateFromPem(cer)
    const rootKey = pki.privateKeyFromPem(key)
    rootPair = { rootCA, rootKey, cer, key, time, hash }
  }
  return rootPair
}

let serialCounter = 0;
function createSerialNumber() {
  serialCounter++
  if (serialCounter > 0xff) {
    serialCounter = 1
  }
  const ret = new Buffer([serialCounter]).toString('hex')
  if (ret.length === 1) {
    return `0${ret}`
  }
  return ret
}

let middlePair = null 
export function getMiddleCertPair () {
  if (!middlePair) {
    const num = `${Math.floor(Math.random() * 10) + 10}`
    const { key, cert } = generateCert('vo.do', getRootCertPair, true, num)
    const rootCA = pki.certificateFromPem(cert)
    const rootKey = pki.privateKeyFromPem(key)
    middlePair = { rootCA, rootKey, cer: cert, key }
  }
  return middlePair
}

export function generateCert (domain, getUpperCertPair, isIssuer, serialNumber) {
  const { rootCA, rootKey, cer: upperCert } = getUpperCertPair()
  const keys = pki.rsa.generateKeyPair(1024)
  const cert = pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = serialNumber || createSerialNumber()
  const curYear = new Date().getFullYear()
  cert.validity.notBefore = new Date()
  cert.validity.notBefore.setFullYear(curYear - 1)
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(curYear + 1)
  const attrs = [
    {
      name: 'commonName',
      value: domain,
    },
    {
      name: 'countryName',
      value: 'CN',
    },
    {
      shortName: 'ST',
      value: 'Beijing',
    },
    {
      name: 'localityName',
      value: 'Beijing',
    },
    {
      name: 'organizationName',
      value: 'Vodo',
    },
    {
      shortName: 'OU',
      value: 'VodoProxy',
    }
  ]
  cert.setSubject(attrs)
  cert.setIssuer(rootCA.subject.attributes)
  if (isIssuer) {
    cert.setExtensions([
      {
        id: '2.5.29.19',
        critical: false,
        value: new Buffer([0x30, 0x03, 0x01, 0x01, 0xc3, 0xbf]).toString(),
        name: 'basicConstraints',
        cA: true
      }
    ])
  } else {
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: true
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true,
        codeSigning: true,
        emailProtection: true,
        timeStamping: true
      },
      {
        name: 'nsCertType',
        client: true,
        server: true,
        email: true,
        objsign: true,
        sslCA: true,
        emailCA: true,
        objCA: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          {
            type: 2,
            value: domain
          }
        ]
      },
      {
        name: 'subjectKeyIdentifier'
      }
    ])
  }
  cert.sign(rootKey, md.sha256.create())
  const keyString = pki.privateKeyToPem(keys.privateKey)
  const certString = pki.certificateToPem(cert)
  return {
    key: keyString,
    cert: certString + upperCert,
    upperCert
  }
}

export function ensureRootCA () {
  try {
    return getRootCertPair()
  } catch (err) {
    console.error('Generate new root CA')
  }
  const keys = pki.rsa.generateKeyPair(1024)
  const cert = pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = createSerialNumber()
  const curYear = new Date().getFullYear()
  cert.validity.notBefore = new Date()
  cert.validity.notBefore.setFullYear(curYear - 1)
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(curYear + 10)
  const timeStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString().replace(/(\.[0-9]+)?Z/, '').replace(/[\-\:]/g, '').replace('T', '.')
  const hash = `${timeStr}.H.${Math.random().toFixed(6).split('.')[1]}`
  const attrs = [
    {
      name: 'commonName',
      value: `Vodo ${hash}`
    },
    {
      name: 'countryName',
      value: 'CN',
    },
    {
      shortName: 'ST',
      value: 'Beijing',
    },
    {
      name: 'localityName',
      value: 'Beijing',
    },
    {
      name: 'organizationName',
      value: 'Vodo',
    },
    {
      shortName: 'OU',
      value: 'VodoProxy',
    }
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.setExtensions([
    {
      id: '2.5.29.19',
      critical: false,
      value: new Buffer([0x30, 0x03, 0x01, 0x01, 0xc3, 0xbf]).toString(),
      name: 'basicConstraints',
      cA: true
    }
  ])
  cert.sign(keys.privateKey, md.sha256.create())
  const keyString = pki.privateKeyToPem(keys.privateKey)
  const certString = pki.certificateToPem(cert)
  writeFileSync(rootCaFile, JSON.stringify({
    key: keyString,
    cer: certString,
    time: Date.now(),
    hash
  }))
}

