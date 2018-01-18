import { pki, md } from 'node-forge'
import { readFileSync, writeFileSync } from 'fs'

export function main () {
  IPC.answer('gen-ssl', (domain) => {
    return generateCert(domain)
  })
}

const rootCaFile = userDir('ca.json')

let rootPair = null
export function getRootPair () {
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
  serialCounter++;
  const ret = `${serialCounter}`
  if (ret.length & 1) {
    return `0${ret}`
  }
  return ret
}

function generateCert (domain) {
  const { rootCA, rootKey } = getRootPair()
  const keys = pki.rsa.generateKeyPair(1024)
  const cert = pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = createSerialNumber()
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
      value: 'Zokor',
    },
    {
      shortName: 'OU',
      value: 'ZokorProxy',
    }
  ]
  cert.setSubject(attrs)
  cert.setIssuer(rootCA.subject.attributes)
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
  cert.sign(rootKey, md.sha256.create())
  const keyString = pki.privateKeyToPem(keys.privateKey)
  const certString = pki.certificateToPem(cert)
  return {
    key: keyString,
    cert: certString,
  }
}

export function ensureRootCA () {
  try {
    return getRootPair()
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
  const timeStr = new Date(Date.now() - new Date().getTimezoneOffset())
    .toISOString().replace(/(\.[0-9]+)?Z/, '').replace(/[\-\:]/g, '').replace('T', '.')
  const hash = `${timeStr}.H.${Math.random().toFixed(6).split('.')[1]}`
  const attrs = [
    {
      name: 'commonName',
      value: `Zokor ${hash}`
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
      value: 'Zokor',
    },
    {
      shortName: 'OU',
      value: 'ZokorProxy',
    }
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
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
