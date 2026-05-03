import multer from "multer";

const storage = multer.memoryStorage();

function csvFileFilter(req, file, cb) {
  const isCsv =
    file.mimetype === "text/csv" ||
    file.mimetype === "application/vnd.ms-excel" ||
    file.originalname.toLowerCase().endsWith(".csv");

  if (!isCsv) {
    return cb(new Error("Only CSV files are allowed"));
  }

  cb(null, true);
}

const uploadCsv = multer({
  storage,
  fileFilter: csvFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default uploadCsv;
