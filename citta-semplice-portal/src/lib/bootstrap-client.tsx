'use client';

import { useEffect } from 'react';

export default function BootstrapClient() {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('bootstrap-italia/dist/js/bootstrap-italia.bundle.min.js');
  }, []);
  return null;
}
