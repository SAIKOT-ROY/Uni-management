import { Schema, model } from "mongoose";
import { TAcademicSemester } from "./academic.interface";
import { AcademicSemesterCode, AcademicSemesterName, Months } from "./academic.constants";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";



const academicSemesterSchema = new Schema<TAcademicSemester>(
    {
      name: {
        type: String,
        required: true,
        enum: AcademicSemesterName,
      },
      year: {
        type: String,
        required: true,
      },
      code: {
        type: String,
        required: true,
        enum: AcademicSemesterCode,
      },
      startMonth: {
        type: String,
        required: true,
        enum: Months,
      },
      endMonth: {
        type: String,
        required: true,
        enum: Months,
      },
    },
    {
      timestamps: true,
    },
  );

academicSemesterSchema.pre('save', async function (next) {
    const isSemesterExists = await AcademicSemester.findOne({
        name: this.name,
        year: this.year,
    })

    if(isSemesterExists){
        throw new AppError(httpStatus.NOT_ACCEPTABLE ,'Semester Already Exists!')
    }

    next()
})

export const AcademicSemester = model<TAcademicSemester>('AcademicSemester', academicSemesterSchema)



