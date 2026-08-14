import AdminLayout from './AdminLayout';
import { AdminUiProvider } from './AdminUiProvider';

export default function AdminShell() {
  return (
    <AdminUiProvider>
      <AdminLayout />
    </AdminUiProvider>
  );
}
