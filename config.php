<?php
/**
 * BMS website configuration. Safe to edit. Not served to visitors (see .htaccess).
 */
return [
    // Where private data lives (login, content, inquiries, sessions). Best practice on a server where you can:
    // point this to a folder OUTSIDE the public web root, e.g. '/home/youruser/bms-data'. It must be writable by PHP.
    'data_dir'   => __DIR__ . '/data',
    'upload_dir' => __DIR__ . '/uploads',

    'timezone'   => 'Asia/Jakarta',

    // Public address, no trailing slash, e.g. 'https://www.berkatmuri.co.id'. Leave '' to detect it from the request.
    'base_url'   => '',

    // Set true ONLY if the site sits behind a proxy/CDN you trust (Cloudflare, nginx proxy...). PHP then reads the
    // visitor's real IP from CF-Connecting-IP / X-Forwarded-For. Leave false otherwise: those headers can be forged.
    'trust_proxy_headers' => false,

    // Also e-mail every website enquiry to this address (needs working mail() on the host). '' = off.
    'notify_email' => '',

    // Admin security
    'session_idle'        => 1800,   // sign out after 30 minutes without activity
    'session_max'         => 28800,  // ...and always after 8 hours
    'login_max_fails_ip'  => 5,      // wrong passwords allowed per IP address...
    'login_max_fails_user'=> 20,     // ...and per username (from all IPs together)...
    'login_lock_seconds'  => 900,    // ...before logins are blocked for this long
    'upload_max_bytes'    => 5 * 1024 * 1024,
    'revisions_keep'      => 30,

    // Company facts shown in the footer, contact page and menu (same as the original site.json).
    'site' => [
        'name'  => 'PT Berkat Muri Sejahtera',
        'short' => 'BMS',
        'nib'   => '0807240054536',
        'whatsapp' => '6281289090842',
        'email' => 'contact.ptbms@gmail.com',
        'contacts' => [
            ['name' => 'Kris Dwi Atmaja',    'display' => '0812-8909-0842', 'e164' => '6281289090842'],
            ['name' => 'Kristian Febrianta', 'display' => '0817-8819-4848', 'e164' => '6281788194848'],
        ],
    ],
];
