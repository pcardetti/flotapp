import { redirect } from 'next/navigation';

export default async function Empresa({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  redirect(`/empresa/${org}/panel`);
}
