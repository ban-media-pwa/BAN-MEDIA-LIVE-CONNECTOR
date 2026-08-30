/**
 * BAN MEDIA LIVE CONNECTOR
 * FILE: server.js
 *
 * Local Browser Connector prototype.
 *
 * Responsibilities:
 * - Run a localhost-only connector server.
 * - Open a real Chromium persistent context per LIVE SOURCE.
 * - Keep each source in an isolated browser profile.
 * - Open LIVE Backstage for direct Admin login.
 * - Report connector/browser status.
 *
 * Security:
 * - No password handling.
 * - No cookie export.
 * - No session/token export.
 * - No credentials sent to Google Apps Script.
 * - Server binds only to 127.0.0.1.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const CONFIG = require('./config');

const app = express();

app.use(express.json({ limit: '64kb' }));

const browsers = new Map();


function ensureProfilesRoot() {
  fs.mkdirSync(CONFIG.profiles.root, {
    recursive: true
  });
}


function getSource(sourceId) {
  return CONFIG.sources.find(
    source => source.sourceId === String(sourceId)
  ) || null;
}


function getProfilePath(source) {
  return path.join(
    CONFIG.profiles.root,
    source.sourceId
  );
}


function getSourceStatus(sourceId) {
  const item = browsers.get(sourceId);

  if (!item) {
    return {
      sourceId,
      status: 'DISCONNECTED'
    };
  }

  return {
    sourceId,
    status: item.context ? 'CONNECTED' : 'ERROR',
    pageCount: item.context
      ? item.context.pages().length
      : 0
  };
}


async function openSource(sourceId) {

  const source = getSource(sourceId);

  if (!source) {
    throw new Error(
      `Không tìm thấy LIVE SOURCE: ${sourceId}`
    );
  }


  const existing = browsers.get(sourceId);

  if (existing && existing.context) {

    const pages =
      existing.context.pages();

    if (pages.length > 0) {

      await pages[0].bringToFront();

      return getSourceStatus(sourceId);

    }
  }


  ensureProfilesRoot();


  const profilePath =
    getProfilePath(source);


  fs.mkdirSync(profilePath, {
    recursive: true
  });


  const context =
    await chromium.launchPersistentContext(
      profilePath,
      {
        headless:
          CONFIG.chromium.headless,

        viewport:
          CONFIG.chromium.viewport,

        acceptDownloads: false,

        serviceWorkers: 'allow'
      }
    );


  let pages =
    context.pages();


  let page;


  if (pages.length > 0) {
    page = pages[0];
  } else {
    page = await context.newPage();
  }


  await page.goto(
    CONFIG.backstage.url,
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }
  ).catch(() => {
    /*
     * Trang có thể tiếp tục load sau navigation timeout.
     * Không tự đăng nhập hoặc xử lý credential.
     */
  });


  browsers.set(sourceId, {

    context,

    openedAt:
      new Date().toISOString()

  });


  return getSourceStatus(sourceId);
}


async function closeSource(sourceId) {

  const item =
    browsers.get(sourceId);


  if (
    !item ||
    !item.context
  ) {

    return {
      sourceId,
      status: 'DISCONNECTED'
    };

  }


  await item.context.close();


  browsers.delete(sourceId);


  return {
    sourceId,
    status: 'DISCONNECTED'
  };
}


async function reloadSource(sourceId) {

  const source =
    getSource(sourceId);


  if (!source) {

    throw new Error(
      `Không tìm thấy LIVE SOURCE: ${sourceId}`
    );

  }


  const item =
    browsers.get(sourceId);


  if (
    !item ||
    !item.context
  ) {

    return openSource(sourceId);

  }


  const pages =
    item.context.pages();


  const page =
    pages.length > 0
      ? pages[0]
      : await item.context.newPage();


  await page.reload({

    waitUntil:
      'domcontentloaded',

    timeout:
      60000

  }).catch(() => {});


  await page.bringToFront();


  return getSourceStatus(sourceId);
}


/* =========================================================
   HEALTH
   ========================================================= */

app.get('/health', (req, res) => {

  res.json({

    success: true,

    module:
      'BAN MEDIA LIVE CONNECTOR',

    status:
      'READY',

    host:
      CONFIG.server.host,

    port:
      CONFIG.server.port,

    timestamp:
      new Date().toISOString()

  });

});


/* =========================================================
   SOURCES
   ========================================================= */

app.get('/api/sources', (req, res) => {

  const sources =
    CONFIG.sources.map(source => ({

      sourceId:
        source.sourceId,

      sourceName:
        source.sourceName,

      browserType:
        source.browserType,

      profileName:
        source.profileName,

      status:
        getSourceStatus(
          source.sourceId
        ).status

    }));


  res.json({

    success: true,

    sources

  });

});


/* =========================================================
   OPEN SOURCE
   ========================================================= */

app.post(
  '/api/sources/:sourceId/open',
  async (req, res) => {

    try {

      const result =
        await openSource(
          req.params.sourceId
        );


      res.json({

        success: true,

        ...result

      });

    } catch (error) {

      console.error(error);


      res.status(400).json({

        success: false,

        error:
          error.message

      });

    }

  }
);


/* =========================================================
   RELOAD SOURCE
   ========================================================= */

app.post(
  '/api/sources/:sourceId/reload',
  async (req, res) => {

    try {

      const result =
        await reloadSource(
          req.params.sourceId
        );


      res.json({

        success: true,

        ...result

      });

    } catch (error) {

      console.error(error);


      res.status(400).json({

        success: false,

        error:
          error.message

      });

    }

  }
);


/* =========================================================
   CLOSE SOURCE
   ========================================================= */

app.post(
  '/api/sources/:sourceId/close',
  async (req, res) => {

    try {

      const result =
        await closeSource(
          req.params.sourceId
        );


      res.json({

        success: true,

        ...result

      });

    } catch (error) {

      console.error(error);


      res.status(400).json({

        success: false,

        error:
          error.message

      });

    }

  }
);


/* =========================================================
   STATUS
   ========================================================= */

app.get(
  '/api/sources/:sourceId/status',
  (req, res) => {

    const source =
      getSource(
        req.params.sourceId
      );


    if (!source) {

      return res.status(404).json({

        success: false,

        error:
          'LIVE SOURCE không tồn tại.'

      });

    }


    res.json({

      success: true,

      ...getSourceStatus(
        source.sourceId
      )

    });

  }
);


/* =========================================================
   GRACEFUL SHUTDOWN
   ========================================================= */

async function shutdown(signal) {

  console.log(
    `\n${signal} received. Closing browser contexts...`
  );


  for (
    const [sourceId, item]
    of browsers
  ) {

    try {

      if (
        item &&
        item.context
      ) {

        await item.context.close();

      }

    } catch (error) {

      console.error(
        `Không thể đóng ${sourceId}:`,
        error.message
      );

    }

  }


  browsers.clear();


  process.exit(0);

}


process.on(
  'SIGINT',
  () => shutdown('SIGINT')
);


process.on(
  'SIGTERM',
  () => shutdown('SIGTERM')
);


/* =========================================================
   START
   ========================================================= */

ensureProfilesRoot();


app.listen(
  CONFIG.server.port,
  CONFIG.server.host,
  () => {

    console.log('');

    console.log(
      '=============================================='
    );

    console.log(
      ' BAN MEDIA LIVE CONNECTOR'
    );

    console.log(
      '=============================================='
    );

    console.log(
      ` Local: http://${CONFIG.server.host}:${CONFIG.server.port}`
    );

    console.log(
      ` Backstage: ${CONFIG.backstage.url}`
    );

    console.log(
      ` Sources: ${CONFIG.sources.length}`
    );

    console.log(
      ' Credential: LOCAL ONLY'
    );

    console.log(
      '=============================================='
    );

    console.log('');

  }
);
