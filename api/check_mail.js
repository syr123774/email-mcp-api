const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

module.exports = async (req, res) => {
  res.setHeader('Access‑Control‑Allow‑Origin', '*');
  res.setHeader('Access‑Control‑Allow‑Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = new ImapFlow({
    host: 'imap.qq.com',
    port: 993,
    secure: true,
    auth: {
      user: process.env.QQ_EMAIL,
      pass: process.env.QQ_AUTH_CODE
    },
    logger: false
  });

  try {
    await client.connect();
    let lock = await client.getMailboxLock('INBOX');
    let messages = [];

    try {
      const searchResult = await client.search({ seen: false });
      if (searchResult.length > 0) {
        const targetSeq = searchResult.slice(-3);
        for await (let msg of client.fetch(targetSeq, { envelope: true, source: true })) {
          const parsed = await simpleParser(msg.source);
          messages.push({
            subject: msg.envelope.subject || '无主题',
            from: msg.envelope.from?.[0]?.address || '未知发件人',
            date: msg.envelope.date,
            content: (parsed.text || '（无文字内容）').trim().slice(0,500)
          });
        }
        await client.messageFlagsAdd(targetSeq, ['\\Seen']);
      }
    } finally {
      lock.release();
    }
    await client.logout();

    if (messages.length === 0) {
      return res.json({
        success: true,
        count: 0,
        emails: [],
        notice: "暂无新邮件"
      });
    }
    return res.json({ success: true, count: messages.length, emails: messages });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

