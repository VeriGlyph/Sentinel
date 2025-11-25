import knex from "knex";
import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('certificates', (table) => {
        table.string('id').primary();
        table.string('tx_hash').notNullable();
        table.integer('block_height').notNullable();
        table.integer('slot').notNullable();
        table.string('provider').notNullable();
        table.integer('metadata_key').notNullable();
        table.jsonb('raw_payload').notNullable();
        table.jsonb('parsed_payload').nullable();
        table.string('certificate_type').notNullable();
        table.enum('status', ['valid', 'invalid', 'unparsed']).notNullable();
        table.jsonb('validation_errors').nullable();
        table.boolean('signature_valid').nullable();
        table.jsonb('signature_verified_by').nullable();
        table.timestamp('observed_at', {useTz: true}).notNullable();
        table.timestamp('validated_at', {useTz: true}).notNullable();
        table.timestamp('created_at', {useTz: true}).defaultTo(knex.fn.now());
        table.timestamp('updated_at', {useTz: true}).defaultTo(knex.fn.now());

        table.index(['certificate_type', 'status']);
        table.index(['block_height']);
        table.index(['slot']);
        table.index(['observed_at']);
    });

    await knex.schema.createTable('provider_checkpoints', (table) => {
        table.string('provider').primary();
        table.integer('cursor').notNullable();
        table.string('last_tx_hash').nullable();
        table.timestamp('updated_at', {useTz: true}).defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('provider_checkpoints');
    await knex.schema.dropTableIfExists('certificates');
}
