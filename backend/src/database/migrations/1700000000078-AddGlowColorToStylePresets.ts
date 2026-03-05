import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGlowColorToStylePresets1700000000078 implements MigrationInterface {
    name = 'AddGlowColorToStylePresets1700000000078'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "style_presets" ADD "glowColor" character varying(32)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "style_presets" DROP COLUMN "glowColor"`);
    }

}
