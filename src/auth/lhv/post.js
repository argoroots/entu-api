'use strict'

const _get = require('lodash/get')
const _has = require('lodash/has')
const _h = require('../../_helpers')
const crypto = require('crypto')

const strWithLength = (str) => {
  return ('000' + str.length).slice(-3) + str
}

exports.handler = async (event, context) => {
  if (event.source === 'aws.events') { return _h.json({ message: 'OK' }) }

  try {
    const lhvId = await _h.ssmParameter('entu-api-lhv-id')
    const lhvKey = await _h.ssmParameter('entu-api-lhv-public')

    const request = _h.getBody(event)

    const mac = [
      request.VK_SERVICE,
      request.VK_VERSION,
      request.VK_USER,
      request.VK_DATETIME,
      request.VK_SND_ID,
      request.VK_REC_ID,
      request.VK_USER_NAME,
      request.VK_USER_ID,
      request.VK_COUNTRY,
      request.VK_OTHER,
      request.VK_TOKEN,
      request.VK_RID
    ].map(strWithLength).join('')

    const now = new Date()
    const datetime = new Date(request.VK_DATETIME)
    const datetimeMin = new Date(datetime.getTime() - 300000)
    const datetimeMax = new Date(datetime.getTime() + 300000)

    if (!crypto.createVerify('SHA1').update(mac).verify(lhvKey, request.VK_MAC, 'base64')) {
      return _h.error([400, 'Invalid VK_MAC'])
    }
    if (_get(request, 'VK_SERVICE') !== '3012') {
      return _h.error([400, 'Invalid VK_SERVICE'])
    }
    if (_get(request, 'VK_SND_ID') !== 'LHV') {
      return _h.error([400, 'Invalid VK_SND_ID'])
    }
    if (_get(request, 'VK_REC_ID') !== lhvId) {
      return _h.error([400, 'Invalid VK_REC_ID'])
    }
    if (now < datetimeMin || now > datetimeMax) {
      return _h.error([400, 'Invalid VK_DATETIME'])
    }

    const user = {
      ip: _get(event, 'requestContext.http.sourceIp'),
      provider: 'lhv',
      id: _get(request, 'VK_USER_ID'),
      name: _get(request, 'VK_USER_NAME'),
      email: _get(request, 'VK_USER_ID') + '@eesti.ee'
    }
    const sessionId = await _h.addUserSession(user)

    if (_has(event, 'queryStringParameters.next')) {
      return _h.redirect(`${event.queryStringParameters.next}${sessionId}`)
    } else {
      return _h.json({ key: sessionId })
    }
  } catch (e) {
    return _h.error(e)
  }
}
