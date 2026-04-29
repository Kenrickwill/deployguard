export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Download or share scan reports</p>
      </div>
      <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
        <p className="text-sm">No reports generated yet.</p>
      </div>
    </div>
  );
}
