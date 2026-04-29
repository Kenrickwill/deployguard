import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Manage your connected repositories</p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Project
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
        <p className="text-sm">No projects yet. Create one to start scanning.</p>
      </div>
    </div>
  );
}
