import knex from "knex";
import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('certificates', (table) => {
    table.string('scope_type').nullable();
    table.string('scope_id').nullable();
    table.bigInteger('nonce').nullable();
    table.index(['scope_type', 'scope_id']);
    table.index(['scope_id']);
    table.index(['nonce']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('certificates', (table) => {
    table.dropColumn('scope_type');
    table.dropColumn('scope_id');
    table.dropColumn('nonce');
  });
}
