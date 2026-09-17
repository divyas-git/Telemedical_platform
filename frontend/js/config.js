/**
 * config.js
 * -----------------------------------------------------------------------
 * Single place to configure the backend API base URL.
 *
 * The frontend NEVER hardcodes a production URL anywhere else in the code.
 * Every fetch call in this app goes through js/api.js, which reads
 * API_BASE_URL from here.
 *
 * To point the dashboard at a different backend (e.g. a deployed Spring
 * Boot instance), change the value below, or set it before this script
 * loads via:
 *
 *   <script>window.HMD_API_BASE_URL = "https://my-backend.example.com";</script>
 *   <script src="js/config.js"></script>
 */
const API_BASE_URL = window.HMD_API_BASE_URL || 'http://localhost:8080';
