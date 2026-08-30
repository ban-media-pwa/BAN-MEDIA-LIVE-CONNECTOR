/**
 * BAN MEDIA LIVE CONNECTOR
 * FILE: config.js
 *
 * Cấu hình local Browser Connector.
 *
 * QUAN TRỌNG:
 * - Không lưu password.
 * - Không lưu cookie.
 * - Không lưu session ID.
 * - Không lưu access token.
 * - Không lưu thông tin đăng nhập TikTok.
 *
 * Session của từng Browser Profile sẽ được
 * Chromium/Playwright lưu cục bộ trên máy Admin.
 */

const path = require('path');

const CONFIG = {

  /**
   * Local server của Browser Connector.
   */
  server: {
    host: '127.0.0.1',
    port: 8787
  },


  /**
   * URL LIVE Backstage.
   *
   * Đây chỉ là địa chỉ trang cần mở.
   * Không chứa credential.
   */
  backstage: {
    url: 'https://live-backstage.tiktok.com/'
  },


  /**
   * Thư mục lưu Browser Profile.
   *
   * Các profile này nằm LOCAL trên máy Admin.
   *
   * KHÔNG commit thư mục này lên GitHub.
   */
  profiles: {
    root: path.join(
      __dirname,
      'profiles'
    )
  },


  /**
   * Danh sách LIVE SOURCE.
   *
   * Đây là cấu hình local mặc định để prototype.
   *
   * Sau này có thể đồng bộ danh sách này
   * từ BAN MEDIA Web App.
   */
  sources: [
    {
      sourceId: 'LS-001',
      sourceName: 'LIVE Source 01',
      browserType: 'Chrome',
      profileName: 'BANMEDIA-LIVE-01'
    },

    {
      sourceId: 'LS-002',
      sourceName: 'LIVE Source 02',
      browserType: 'Chrome',
      profileName: 'BANMEDIA-LIVE-02'
    },

    {
      sourceId: 'LS-003',
      sourceName: 'LIVE Source 03',
      browserType: 'Coc Coc',
      profileName: 'BANMEDIA-LIVE-03'
    },

    {
      sourceId: 'LS-004',
      sourceName: 'LIVE Source 04',
      browserType: 'Edge',
      profileName: 'BANMEDIA-LIVE-04'
    }
  ],


  /**
   * Chromium settings.
   */
  chromium: {

    /**
     * Chạy browser có giao diện thật.
     *
     * false = hiển thị cửa sổ Chromium.
     */
    headless: false,

    /**
     * Kích thước viewport.
     */
    viewport: {
      width: 1366,
      height: 768
    },

    /**
     * Không tự động đóng browser khi connector
     * process kết thúc bất thường nếu có thể.
     */
    keepProfile: true
  },


  /**
   * Security.
   *
   * Connector chỉ bind localhost.
   *
   * Không mở trực tiếp ra Internet.
   */
  security: {

    localhostOnly: true,

    allowedOrigins: [
      'http://localhost',
      'http://127.0.0.1'
    ]

  }

};


module.exports = CONFIG;
