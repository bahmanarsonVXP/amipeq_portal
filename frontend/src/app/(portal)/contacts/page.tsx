'use client';

import { useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { ContactDrawer } from '@/components/contacts/ContactDrawer';
import { CompanyDrawer } from '@/components/clients/CompanyDrawer';
import { useContacts } from '@/hooks/useContacts';
import {
  formatContactFirstName,
  formatContactPrimaryLine,
} from '@/lib/contactDisplay';
import { formatCreatedUpdatedMeta } from '@/lib/metaDates';
import { formatPhoneDisplay } from '@/lib/phone';
import type { ContactListItem } from '@/types';

type DrawerState =
  | { mode: 'closed' }
  | { mode: 'view'; contactId: string; editing?: boolean }
  | { mode: 'create' };

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState<DrawerState>({ mode: 'closed' });
  const [companyDrawerId, setCompanyDrawerId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useContacts(search.trim() || undefined);
  const contacts = data?.contacts ?? [];

  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.toLocaleLowerCase('fr-FR');
      const nameB = `${b.lastName} ${b.firstName}`.toLocaleLowerCase('fr-FR');
      return nameA.localeCompare(nameB, 'fr-FR');
    });
  }, [contacts]);

  function closeDrawer() {
    setDrawer({ mode: 'closed' });
  }

  return (
    <div>
      <ContactDrawer
        contactId={drawer.mode === 'view' ? drawer.contactId : null}
        mode={drawer.mode === 'create' ? 'create' : 'view'}
        initialEditing={drawer.mode === 'view' ? Boolean(drawer.editing) : false}
        onClose={closeDrawer}
        onSaved={() => mutate()}
        onDeleted={() => mutate()}
        onOpenCompany={(companyId) => {
          closeDrawer();
          setCompanyDrawerId(companyId);
        }}
      />

      <CompanyDrawer
        companyId={companyDrawerId}
        onClose={() => setCompanyDrawerId(null)}
        onSelectOpportunity={() => {}}
      />

      <Header
        title="Contacts"
        subtitle="Annuaire des contacts commerciaux"
        action={{
          label: 'Nouveau contact',
          onClick: () => setDrawer({ mode: 'create' }),
        }}
      />

      <div className="p-6 md:p-8">
        <div className="mb-6 max-w-md">
          <Input
            placeholder="Rechercher un contact, un client, un email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50" padding="md">
            <p className="text-sm text-red-800">
              Impossible de charger les contacts. Vérifiez la session et le gateway.
            </p>
            <div className="mt-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => mutate()}>
                Réessayer
              </Button>
            </div>
          </Card>
        )}

        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-6 py-3">Contact</th>
                  <th className="px-6 py-3">Client</th>
                  <th className="px-6 py-3">Fonction</th>
                  <th className="px-6 py-3">Téléphone</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                      Chargement…
                    </td>
                  </tr>
                )}
                {!isLoading && sortedContacts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                      Aucun contact trouvé.
                    </td>
                  </tr>
                )}
                {sortedContacts.map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    onOpen={() => setDrawer({ mode: 'view', contactId: contact.id })}
                    onEdit={() =>
                      setDrawer({ mode: 'view', contactId: contact.id, editing: true })
                    }
                    onDelete={() => setDrawer({ mode: 'view', contactId: contact.id })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {!isLoading && sortedContacts.length > 0 && (
          <p className="mt-3 text-right text-xs text-gray-400">
            {sortedContacts.length} contact{sortedContacts.length > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

function ContactRow({
  contact,
  onOpen,
  onEdit,
  onDelete,
}: {
  contact: ContactListItem;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const primaryLine = formatContactPrimaryLine(contact);
  const firstNameLabel = formatContactFirstName(contact.firstName);
  const phoneLabel = formatPhoneDisplay(contact.phone, contact.phoneCode);

  return (
    <tr className="cursor-pointer hover:bg-gray-50/80" onClick={onOpen}>
      <td className="px-6 py-3">
        <div className="min-w-[200px]">
          <p className="font-semibold text-primary-700">{primaryLine}</p>
          {firstNameLabel && (
            <p className="mt-0.5 text-xs text-gray-600">{firstNameLabel}</p>
          )}
          <p className="mt-2 text-[11px] italic text-gray-500">
            {formatCreatedUpdatedMeta(contact.createdAt, contact.updatedAt)}
          </p>
        </div>
      </td>
      <td className="px-6 py-3 text-gray-800">{contact.companyName ?? '—'}</td>
      <td className="px-6 py-3 text-gray-600">{contact.jobTitle ?? '—'}</td>
      <td className="px-6 py-3 text-gray-600">{phoneLabel ?? '—'}</td>
      <td className="px-6 py-3">
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            onClick={(e) => e.stopPropagation()}
            className="break-all text-primary-700 hover:underline"
          >
            {contact.email}
          </a>
        ) : (
          '—'
        )}
      </td>
      <td className="px-6 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <RowActionsMenu
          ariaLabel={`Actions pour ${primaryLine}`}
          actions={[
            { label: 'Modifier', onClick: onEdit },
            { label: 'Supprimer', danger: true, onClick: onDelete },
          ]}
        />
      </td>
    </tr>
  );
}
