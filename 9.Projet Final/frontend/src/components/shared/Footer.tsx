import React from 'react';

const Footer = () => {
  return (
    <footer className="flex items-center justify-between p-4 border-t border-gray-200">
      <p className="text-sm text-gray-500">© {new Date().getFullYear()} PatriDefi. All rights reserved.</p>
    </footer>
  );
}

export default Footer;