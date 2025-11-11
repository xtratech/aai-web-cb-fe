'use client';

import Image from 'next/image';

const PlureeLogo = () => (
  <Image
    src="/PlureeLogo.svg"
    alt="Pluree.ai Logo"
    width={16}
    height={16}
    className="size-4"
    priority
  />
);

export default PlureeLogo;
