-- AlterTable
ALTER TABLE "istanza_attivita" RENAME CONSTRAINT "workflows_pkey" TO "istanza_attivita_pkey";

-- AlterTable
ALTER TABLE "istanza_fasi" RENAME CONSTRAINT "workflow_fasi_pkey" TO "istanza_fasi_pkey";

-- RenameForeignKey
ALTER TABLE "allegati" RENAME CONSTRAINT "allegati_workflow_id_fkey" TO "allegati_attivita_id_fkey";

-- RenameForeignKey
ALTER TABLE "istanza_attivita" RENAME CONSTRAINT "workflows_completata_da_id_fkey" TO "istanza_attivita_completata_da_id_fkey";

-- RenameForeignKey
ALTER TABLE "istanza_attivita" RENAME CONSTRAINT "workflows_istanza_id_fkey" TO "istanza_attivita_istanza_id_fkey";

-- RenameForeignKey
ALTER TABLE "istanza_attivita" RENAME CONSTRAINT "workflows_step_id_fkey" TO "istanza_attivita_step_id_fkey";

-- RenameForeignKey
ALTER TABLE "istanza_fasi" RENAME CONSTRAINT "workflow_fasi_fase_id_fkey" TO "istanza_fasi_fase_id_fkey";

-- RenameForeignKey
ALTER TABLE "istanza_fasi" RENAME CONSTRAINT "workflow_fasi_istanza_id_fkey" TO "istanza_fasi_istanza_id_fkey";

-- RenameForeignKey
ALTER TABLE "istanza_fasi" RENAME CONSTRAINT "workflow_fasi_operatore_completamento_id_fkey" TO "istanza_fasi_operatore_completamento_id_fkey";

-- RenameForeignKey
ALTER TABLE "pagamenti_attesi" RENAME CONSTRAINT "pagamenti_attesi_workflow_id_fkey" TO "pagamenti_attesi_attivita_id_fkey";

-- RenameIndex
ALTER INDEX "workflows_data_variazione_idx" RENAME TO "istanza_attivita_data_variazione_idx";

-- RenameIndex
ALTER INDEX "workflows_istanza_id_idx" RENAME TO "istanza_attivita_istanza_id_idx";

-- RenameIndex
ALTER INDEX "workflow_fasi_istanza_id_idx" RENAME TO "istanza_fasi_istanza_id_idx";

-- RenameIndex
ALTER INDEX "pagamenti_attesi_workflow_id_key" RENAME TO "pagamenti_attesi_attivita_id_key";
