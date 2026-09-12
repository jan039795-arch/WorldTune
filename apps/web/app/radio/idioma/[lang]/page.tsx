import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { countStations, listLanguages, listStations } from '@worldtune/db';
import { Breadcrumbs } from '@/components/FacetGrid';
import { Pagination } from '@/components/Pagination';
import { StationList } from '@/components/StationList';
import { formatCount } from '@/lib/display';

export const revalidate = 3600;

const PAGE_SIZE = 60;

interface Props {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const language = (await listLanguages()).find((item) => item.code === lang);
  if (!language) return {};
  return {
    title: `Radio en ${language.name}`,
    description: `Emisoras que emiten en ${language.name}, de cualquier parte del mundo.`,
  };
}

export default async function LanguagePage({ params, searchParams }: Props) {
  const [{ lang }, { page }] = await Promise.all([params, searchParams]);
  const language = (await listLanguages()).find((item) => item.code === lang);
  if (!language) notFound();

  const currentPage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const filter = { language: language.code };
  const [stations, total] = await Promise.all([
    listStations({ ...filter, limit: PAGE_SIZE, offset: (currentPage - 1) * PAGE_SIZE }),
    countStations(filter),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ href: '/radio', label: 'Radio' }, { label: language.name }]} />
        <h1 className="text-2xl font-semibold tracking-tight">Radio en {language.name}</h1>
        <p className="mt-1 text-sm text-ink-500">{formatCount(total)} emisoras</p>
      </div>
      <StationList stations={stations} />
      <Pagination
        page={currentPage}
        pageSize={PAGE_SIZE}
        total={total}
        basePath={`/radio/idioma/${language.code}`}
      />
    </div>
  );
}
