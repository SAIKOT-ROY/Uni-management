import { Faculty } from './../faculty/faculty.model';
import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { SemesterRegistration } from "../semesterRegistration/semesterRegistration.model";
import { TOfferedCourse } from "./OfferedCourse.interface";
import { OfferedCourse } from "./OfferedCourse.model";
import { AcademicFaculty } from "../academicFaculty/academicFaculty.model";
import { AcademicDepartment } from "../academicDepartment/academicDepartment.model";
import { Course } from "../course/course.model";
import { hasTimeConflict } from "./OfferedCourse.utils";
import QueryBuilder from '../../builder/QueryBuilder';
import { Student } from '../student/student.model';

const createOfferedCourseIntoDB = async (payload: TOfferedCourse) => {
    const {
        semesterRegistration,
        academicFaculty,
        academicDepartment,
        course,
        section,
        faculty,
        days,
        startTime,
        endTime,
    } = payload

    // check if the semester registration id is exists!
    const isSemesterRegistrationExists = await SemesterRegistration
        .findById(semesterRegistration)

    if (!isSemesterRegistrationExists) {
        throw new AppError(httpStatus.NOT_FOUND, 'Semester registration not found!')
    }

    const academicSemester = isSemesterRegistrationExists.academicSemester

    // check if the academic faculty id is exists!
    const isAcademicFacultyExists = await AcademicFaculty
        .findById(academicFaculty)

    if (!isAcademicFacultyExists) {
        throw new AppError(httpStatus.NOT_FOUND, 'Academic Faculty is not found!')
    }

    // check if the academic faculty id is exists!
    const isAcademicDepartmentExists = await AcademicDepartment
        .findById(academicDepartment)

    if (!isAcademicDepartmentExists) {
        throw new AppError(httpStatus.NOT_FOUND, 'Academic Department is not found!')
    }

    // check if the academic department id is exists!
    const isCourseExists = await Course
        .findById(course)

    if (!isCourseExists) {
        throw new AppError(httpStatus.NOT_FOUND, 'Course is not found!')
    }

    // check if the academic department id is exists!
    const isFacultyExists = await Course
        .findById(faculty)

    if (!isFacultyExists) {
        throw new AppError(httpStatus.NOT_FOUND, 'Faculty is not found!')
    }

    //check if the department is belong to the faculty
    const isDepartmentBelongToFaculty = await AcademicDepartment.findOne({
        _id: academicDepartment,
        academicFaculty,
    })

    if (!isDepartmentBelongToFaculty) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `${isAcademicDepartmentExists} does not belong to this ${isAcademicFacultyExists}`
        )
    }

    const isSameOfferedCourseExistsWithSameRegisteredSemesterWithSameSection = await OfferedCourse.findOne({
        semesterRegistration,
        course,
        section
    })

    if (isSameOfferedCourseExistsWithSameRegisteredSemesterWithSameSection) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Offered course with same section already exist`
        )
    }

    //get the schedule of the faculties
    const assignSchedules = await OfferedCourse.find({
        semesterRegistration,
        faculty,
        days: { $in: days }
    }).select('days startTime endTime')

    const newSchedule = {
        days,
        startTime,
        endTime
    }

    if (hasTimeConflict(assignSchedules, newSchedule)) {
        throw new AppError(
            httpStatus.CONFLICT,
            `This Faculty is not available at that time ! Chose other time or day`
        )
    }

    const result = await OfferedCourse.create({ ...payload, academicSemester });
    return result
}

const getAllOfferedCoursesFromDB = async (query: Record<string, unknown>) => {
    const offeredCourseQuery = new QueryBuilder(OfferedCourse.find(), query)
        .filter()
        .sort()
        .paginate()
        .fields();

    const result = await offeredCourseQuery.modelQuery;
    const meta = await offeredCourseQuery.countTotal()

    return { meta, result };
};

const getSingleOfferedCourseFromDB = async (id: string) => {
    const offeredCourse = await OfferedCourse.findById(id);

    if (!offeredCourse) {
        throw new AppError(404, 'Offered Course not found');
    }

    return offeredCourse;
};

const updateOfferedCourseIntoDB = async (
    id: string,
    payload: Pick<
        TOfferedCourse,
        'faculty' | 'days' | 'startTime' | 'endTime'>
) => {

    const { faculty, days, startTime, endTime } = payload

    const isOfferedCourseExist = await OfferedCourse.findById(id);

    if (!isOfferedCourseExist) {
        throw new AppError(httpStatus.NOT_FOUND, 'Offered Course not found!')
    }

    const isFacultyExist = await Faculty.findById(faculty)

    if (!isFacultyExist) {
        throw new AppError(httpStatus.NOT_FOUND, 'Faculty not found!')
    }

    const semesterRegistration = isOfferedCourseExist.semesterRegistration

    const semesterRegistrationStatus = await SemesterRegistration.findById(semesterRegistration)

    if (semesterRegistrationStatus?.status !== 'UPCOMING') {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `You Can not update this offered course as it is ${semesterRegistrationStatus?.status}`
        )
    }

    //get the schedule of the faculties
    const assignSchedules = await OfferedCourse.find({
        semesterRegistration,
        faculty,
        days: { $in: days }
    }).select('days startTime endTime')

    const newSchedule = {
        days,
        startTime,
        endTime
    }

    if (hasTimeConflict(assignSchedules, newSchedule)) {
        throw new AppError(
            httpStatus.CONFLICT,
            `This Faculty is not available at that time ! Chose other time or day`
        )
    }

    const result = await OfferedCourse.findByIdAndUpdate(
        id,
        payload,
        { new: true }
    )

    return result
}

const deleteOfferedCourseFromDB = async (id: string) => {

    const isOfferedCourseExists = await OfferedCourse.findById(id);

    if (!isOfferedCourseExists) {
        throw new AppError(httpStatus.NOT_FOUND, 'Offered Course not found');
    }

    const semesterRegistation = isOfferedCourseExists.semesterRegistration;

    const semesterRegistrationStatus =
        await SemesterRegistration.findById(semesterRegistation).select('status');

    if (semesterRegistrationStatus?.status !== 'UPCOMING') {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Offered course can not update ! because the semester ${semesterRegistrationStatus}`,
        );
    }

    const result = await OfferedCourse.findByIdAndDelete(id);

    return result;
};

const getMyOfferedCoursesFromDB = async (
    userId: string,
    query: Record<string, unknown>,
) => {

    //pagination setup

    const page = Number(query?.page) || 1
    const limit = Number(query?.limit) || 10
    const skip = (page - 1) * limit;

    //find the student
    const student = await Student.findOne({ id: userId })

    if (!student) {
        throw new AppError(httpStatus.NOT_FOUND, 'User is not found')
    }

    //find current ongoing semester
    const currentOngoingRegistrationSemester = await SemesterRegistration.findOne(
        {
            status: 'ONGOING',
        },
    );

    if (!currentOngoingRegistrationSemester) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            'There is no ongoing semester registration!',
        );
    }


    const aggregationQuery = [
        {
            $match: {
                semesterRegistration: currentOngoingRegistrationSemester?._id,
                academicFaculty: student.academicFaculty,
                academicDepartment: student.academicDepartment,
            },
        },
        {
            $lookup: {
                from: 'courses',
                localField: 'course',
                foreignField: '_id',
                as: 'course',
            },
        },
        {
            $unwind: '$course',
        },
        {
            $lookup: {
                from: 'enrolledcourses',
                let: {
                    currentOngoingRegistrationSemester:
                        currentOngoingRegistrationSemester._id,
                    currentStudent: student._id,
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            '$semesterRegistration',
                                            '$$currentOngoingRegistrationSemester',
                                        ],
                                    },
                                    {
                                        $eq: ['$student', '$$currentStudent'],
                                    },
                                    {
                                        $eq: ['$isEnrolled', true],
                                    },
                                ],
                            },
                        },
                    },
                ],
                as: 'enrolledCourses',
            },
        },
        {
            $lookup: {
                from: 'enrolledcourses',
                let: {
                    currentStudent: student._id,
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: ['$student', '$$currentStudent'],
                                    },
                                    {
                                        $eq: ['$isCompleted', true],
                                    },
                                ],
                            },
                        },
                    },
                ],
                as: 'completedCourses',
            },
        },
        {
            $addFields: {
                completedCourseIds: {
                    $map: {
                        input: '$completedCourses',
                        as: 'completed',
                        in: '$$completed.course',
                    },
                },
            },
        },
        {
            $addFields: {
                isPreRequisitesFulFilled: {
                    $or: [
                        { $eq: ['$course.preRequisiteCourses', []] },
                        {
                            $setIsSubset: [
                                '$course.preRequisiteCourses.course',
                                '$completedCourseIds',
                            ],
                        },
                    ],
                },

                isAlreadyEnrolled: {
                    $in: [
                        '$course._id',
                        {
                            $map: {
                                input: '$enrolledCourses',
                                as: 'enroll',
                                in: '$$enroll.course',
                            },
                        },
                    ],
                },
            },
        },
        {
            $match: {
                isAlreadyEnrolled: false,
                isPreRequisitesFulFilled: true,
            },
        },
    ];

    const paginationQuery = [
        {
            $skip: skip,
        },
        {
            $limit: limit,
        },
    ];


    const result = await OfferedCourse.aggregate([
        ...aggregationQuery,
        ...paginationQuery,
    ]);


    const total = (await OfferedCourse.aggregate(aggregationQuery)).length;

    const totalPage = Math.ceil(result.length / limit);


    return {
        meta: {
            page,
            limit,
            total,
            totalPage,
        },
        result,
    };
};


export const OfferCourseServices = {
    createOfferedCourseIntoDB,
    updateOfferedCourseIntoDB,
    getAllOfferedCoursesFromDB,
    getSingleOfferedCourseFromDB,
    deleteOfferedCourseFromDB,
    getMyOfferedCoursesFromDB
}