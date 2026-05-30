import { redirect } from 'next/navigation';

// Home → participants. The setup dashboard now lives at /setup.
export default function Home() {
  redirect('/participants');
}
