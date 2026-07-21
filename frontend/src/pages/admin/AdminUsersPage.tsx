import { useState } from 'react';
import { useAdminUpdateUser, useAdminUsers } from '@/api/admin';
import { Pagination } from '@/components/Pagination';
import { Badge, Card, PageSpinner, statusBadgeColor } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data, isLoading } = useAdminUsers(page, query);
  const updateUser = useAdminUpdateUser();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Users</h1>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search);
          }}
        >
          <input
            className="input w-64"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-secondary">Search</button>
        </form>
      </div>

      <Card>
        {isLoading || !data ? (
          <PageSpinner />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                  <tr>
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Subscription</th>
                    <th className="py-2 pr-4">Farms</th>
                    <th className="py-2 pr-4">Joined</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 pr-4">
                        <p className="font-medium">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-slate-500">{u.email}{u.emailVerified ? ' ✓' : ' (unverified)'}</p>
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge color={u.role === 'ADMIN' ? 'blue' : 'gray'}>{u.role}</Badge>
                      </td>
                      <td className="py-2.5 pr-4">
                        {u.subscription ? (
                          <Badge color={statusBadgeColor(u.subscription.status)}>
                            {u.subscription.plan.name} · {u.subscription.status}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 pr-4">{u.farmCount}</td>
                      <td className="py-2.5 pr-4 text-slate-500">{formatDate(u.createdAt)}</td>
                      <td className="py-2.5 pr-4">
                        <Badge color={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        {u.id !== me?.id && (
                          <button
                            className={`text-xs ${u.isActive ? 'text-red-600' : 'text-green-600'} hover:underline`}
                            disabled={updateUser.isPending}
                            onClick={() =>
                              updateUser.mutate({ userId: u.id, updates: { isActive: !u.isActive } })
                            }
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
