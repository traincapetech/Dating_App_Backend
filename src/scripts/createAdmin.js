/**
 * Script to create admin user
 *
 * Usage: node server/src/scripts/createAdmin.js <email> <password> <name>
 * Example: node server/src/scripts/createAdmin.js admin@pryvo.com password123 "Admin User"
 */

import {createAdmin} from '../models/Admin.js';

async function main() {
  const [,, email, password, name] = process.argv;

  if (!email || !password || !name) {
    console.error('Usage: node createAdmin.js <email> <password> <name>');
    console.error('Example: node createAdmin.js admin@pryvo.com password123 "Admin User"');
    process.exit(1);
  }

  try {
    const admin = await createAdmin({
      email,
      password,
      name,
      role: 'super_admin', // First admin is super admin
      permissions: [
        'view_users',
        'manage_users',
        'view_subscriptions',
        'manage_subscriptions',
        'process_refunds',
        'view_reports',
        'moderate_content',
        'view_analytics',
      ],
    });

    console.log('✅ Admin created successfully!');
    console.log('Admin ID:', admin.id);
    console.log('Email:', admin.email);
    console.log('Name:', admin.name);
    console.log('Role:', admin.role);
    console.log('\n⚠️  Please change the password after first login!');
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
}

main();

