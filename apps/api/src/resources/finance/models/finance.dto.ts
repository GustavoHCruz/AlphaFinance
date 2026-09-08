import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class MonthQuery {
  @ApiProperty({ example: "2026-09" })
  @Matches(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/)
  month: string;
}
export class CarryoverDto {
  @ApiProperty() @IsBoolean() enabled: boolean;
}
export class EntryDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) description: string;
  @ApiProperty({ enum: ["income", "expense", "bill", "investment"] })
  @IsIn(["income", "expense", "bill", "investment"])
  kind: "income" | "expense" | "bill" | "investment";
  @ApiProperty({
    description:
      "Integer cents; negative values allowed only for income adjustments.",
  })
  @IsInt()
  @Min(-1000000000)
  @Max(1000000000)
  amount: number;
  @ApiProperty({ example: "2026-09-06" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() done?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string | null;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  labelIds?: string[];
  @ApiPropertyOptional({ enum: ["pix", "credit", "debit", "cash", "transfer"] })
  @IsOptional()
  @IsIn(["pix", "credit", "debit", "cash", "transfer"])
  method?: string;
  @ApiPropertyOptional({
    description:
      "Expected amount in cents; bills share this across their series.",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000)
  expectedAmount?: number | null;
  @ApiPropertyOptional({
    description:
      "Actual paid or invested amount in cents, required for completion.",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000)
  paidAmount?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() recurring?: boolean;
  @ApiPropertyOptional({
    description: "Basis points: 1500 = 15%. Investments only.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  percentageBps?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() incomeCategoryId?:
    | string
    | null;
  @ApiPropertyOptional({
    description:
      "An estimate recalculates with income; false freezes the confirmed contribution.",
  })
  @IsOptional()
  @IsBoolean()
  estimated?: boolean;
}
export class UpdateEntryDto extends PartialType(EntryDto) {}
export class TagDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(50) name: string;
  @ApiProperty({ example: "#c49b45" })
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color: string;
  @ApiProperty({ enum: ["category", "label"] })
  @IsIn(["category", "label"])
  type: "category" | "label";
  @ApiProperty({ enum: ["income", "expense", "bill", "investment"] })
  @IsIn(["income", "expense", "bill", "investment"])
  kind: "income" | "expense" | "bill" | "investment";
}
export class CopyTagDto {
  @ApiProperty({ enum: ["income", "expense", "bill", "investment"] })
  @IsIn(["income", "expense", "bill", "investment"])
  kind: "income" | "expense" | "bill" | "investment";
}
export class OrderTagsDto extends CopyTagDto {
  @ApiProperty({ enum: ["category", "label"] })
  @IsIn(["category", "label"])
  type: "category" | "label";
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  ids: string[];
}
export class ProfileDto {
  @ApiProperty({ enum: ["pt-BR", "en-US"] })
  @IsIn(["pt-BR", "en-US"])
  locale: string;
  @ApiProperty({ enum: ["BRL", "USD", "EUR"] })
  @IsIn(["BRL", "USD", "EUR"])
  currency: string;
}
