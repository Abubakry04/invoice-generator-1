import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Edit2,
  Trash2,
  FilePlus,
  Receipt,
  Download,
} from 'lucide-react';
import { useClientStore } from '../../store/clientStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ClientModal } from './ClientModal';
import { ClientStatementModal } from './ClientStatementModal';
import { Client, Invoice } from '../../types';
import { exportClientsToCSV } from '../../lib/exportUtils';
import { calculateTotals } from '../../lib/calculateTotals';
import { formatCurrency } from '../../lib/formatCurrency';
import { useSettingsStore } from '../../store/settingsStore';
import { FileText } from 'lucide-react';

export const ClientsPage: React.FC = () => {
  const navigate = useNavigate();
  const { clients, addClient, updateClient, deleteClient } = useClientStore();
  const { invoices } = useInvoiceStore();
  const { settings } = useSettingsStore();
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [statementClient, setStatementClient] = useState<Client | null>(null);

  // Filter clients by search
  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [clients, searchQuery]);

  // Financial aggregates per client
  const clientFinancials = useMemo(() => {
    const stats: Record<string, { totalBilled: number; totalPaid: number; outstanding: number; count: number }> = {};
    for (const inv of invoices) {
      const name = inv.client.name.toLowerCase().trim();
      if (!stats[name]) {
        stats[name] = { totalBilled: 0, totalPaid: 0, outstanding: 0, count: 0 };
      }
      const t = calculateTotals(inv.items, inv.discount, inv.taxRate);
      const paid = inv.paidAmount || (inv.status === 'paid' ? t.total : 0);
      stats[name].totalBilled += t.total;
      stats[name].totalPaid += paid;
      stats[name].outstanding += Math.max(0, t.total - paid);
      stats[name].count += 1;
    }
    return stats;
  }, [invoices]);

  const handleSaveClient = (data: Omit<Client, 'id' | 'createdAt'>) => {
    if (editingClient) {
      updateClient(editingClient.id, data);
      toast.success(`Client "${data.name}" updated`);
    } else {
      addClient(data);
      toast.success(`Client "${data.name}" created`);
    }
    setEditingClient(null);
  };

  const handleDeleteClient = () => {
    if (deletingClient) {
      deleteClient(deletingClient.id);
      toast.info(`Client "${deletingClient.name}" deleted`);
      setDeletingClient(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Clients</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your saved client directory and auto-populate invoices with one click.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={() => exportClientsToCSV(clients, invoices)}
            icon={<Download className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Button
            onClick={() => {
              setEditingClient(null);
              setModalOpen(true);
            }}
            icon={<Plus className="w-4 h-4" />}
            size="md"
            className="bg-[#FF7916] hover:bg-[#ea580c] text-white font-bold"
          >
            <span className="hidden sm:inline">Add Client</span>
            <span className="sm:hidden">New Client</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
        <div className="w-full sm:max-w-md">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients..."
            leftAddon={<Search className="w-4 h-4" />}
          />
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
          {filteredClients.length} {filteredClients.length === 1 ? 'Client' : 'Clients'}
        </span>
      </div>

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <EmptyState
          icon={<Users className="w-10 h-10" />}
          title={searchQuery ? 'No matching clients found' : 'No clients saved yet'}
          description={
            searchQuery
              ? `No clients matched "${searchQuery}". Try a different keyword.`
              : 'Add your first client to easily reuse their billing details on future invoices.'
          }
          actionLabel={searchQuery ? undefined : 'Add First Client'}
          onAction={() => {
            setEditingClient(null);
            setModalOpen(true);
          }}
          actionIcon={<Plus className="w-4 h-4" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClients.map((client) => {
            const clientKey = client.name.toLowerCase().trim();
            const fin = clientFinancials[clientKey] || { totalBilled: 0, totalPaid: 0, outstanding: 0, count: 0 };
            const currency = settings.defaultCurrency || 'NGN';

            return (
              <div
                key={client.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-amber-500 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">
                          {client.name}
                        </h3>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          <Receipt className="w-3 h-3 text-blue-500" />
                          {fin.count} {fin.count === 1 ? 'invoice' : 'invoices'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Overview Summary */}
                  <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Billed</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(fin.totalBilled, currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Outstanding</span>
                      <span className={`font-mono font-bold ${fin.outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {fin.outstanding > 0 ? formatCurrency(fin.outstanding, currency) : 'Settled'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 my-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{client.phone}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{client.address}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs py-1.5 h-8 gap-1.5 flex-1"
                    icon={<FileText className="w-3.5 h-3.5 text-[#FF7916]" />}
                    onClick={() => setStatementClient(client)}
                  >
                    Statement
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs py-1.5 h-8 gap-1.5"
                    icon={<FilePlus className="w-3.5 h-3.5 text-blue-600" />}
                    onClick={() => navigate(`/invoices/new?clientName=${encodeURIComponent(client.name)}`)}
                  >
                    Invoice
                  </Button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingClient(client);
                        setModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit client"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingClient(client)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete client"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Client Modal */}
      <ClientModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingClient(null);
        }}
        onSave={handleSaveClient}
        client={editingClient}
      />

      {/* Client Statement Modal */}
      <ClientStatementModal
        client={statementClient}
        isOpen={Boolean(statementClient)}
        onClose={() => setStatementClient(null)}
        invoices={invoices}
        onOpenInvoice={(inv) => {
          setStatementClient(null);
          navigate(`/invoices/${inv.id}/edit`);
        }}
      />

      {/* Delete Client Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingClient}
        onClose={() => setDeletingClient(null)}
        onConfirm={handleDeleteClient}
        title="Delete Client?"
        message={`Are you sure you want to delete "${deletingClient?.name}"? Existing invoices issued to this client will keep their recorded billing details.`}
        confirmLabel="Delete Client"
        variant="danger"
      />
    </div>
  );
};
