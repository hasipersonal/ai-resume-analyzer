import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router';
import FileUploader from '~/components/FileUploader';
import Navbar from '~/components/Navbar'
import { convertPdfToImage } from '~/lib/pdf2image';
import { usePuterStore } from '~/lib/puter';
import { generateUUID } from '~/lib/util';
import {prepareInstructions} from "../../constants";

const upload = () => {

  const {auth, isLoading, fs, ai, kv} = usePuterStore();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleFileSelect = (file: File | null) => {
    setFile(file)
  }

  const handleAnalyze = async ({companyName, jobTitle, jobDescription, file}: {companyName: string, jobTitle: string, jobDescription: string, file: File}) => {
    setIsProcessing(true);
    setStatusText('Uploading your resume...');

    const uploadedFile = await fs.upload([file]);

    if(!uploadedFile) return setStatusText('Failed to upload file. Please try again.');

    setStatusText('Analyzing your resume...');

    const imageFile = await convertPdfToImage(file);
    if(!imageFile.file) return setStatusText('Failed to convert pdf to image. Please try again.');

    setStatusText('Uploading the image...');

    const uploadedImage = await fs.upload([imageFile.file]);
    if(!uploadedImage) return setStatusText('Failed to upload image. Please try again.');

    setStatusText('Peparing data...');

    const uuid = generateUUID();
    const data = {
        id: uuid,
        resumePath: uploadedFile.path,
        imagePath: uploadedImage.path,
        companyName,
        jobTitle,
        jobDescription,
        feedback: '',
    }
    await kv.set(`resume-${uuid}`, JSON.stringify(data));

    setStatusText('Analysing...');

    const feedback = await ai.feedback(
        uploadedFile.path,
        prepareInstructions({jobTitle, jobDescription})
    )

    if(!feedback) {
        console.error("AI feedback returned null");
        return setStatusText('Error : Failed to get feedback. Please try again.');}

    const feefbackText = typeof feedback.message.content === 'string' ?
        feedback.message.content : feedback.message.content[0].text;

    data.feedback = JSON.parse(feefbackText);
    await kv.set(`resume-${uuid}`, JSON.stringify(data));

    setStatusText('Analysis complete! Redirecting...');

    console.log(data);

    navigate(`/resume/${uuid}`);
    
  }

  const handleSubmit = (e:FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const from = e.currentTarget.closest('form');
    if(!from) return;

    const formData = new FormData(from);

    const companyName = formData.get('company-name') as string;
    const jobTitle = formData.get('job-title') as string;
    const jobDescription = formData.get('job-description') as string;

    // console.log(
    //     { companyName, jobTitle, jobDescription, file }
    // );

    if(!file || !companyName || !jobTitle || !jobDescription) return;

    handleAnalyze({ companyName, jobTitle, jobDescription, file });
    
  }

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover">
        <Navbar />

        <section className='main-section'>
            <div className='page-heading py-16'>
                <h1>Smart feedback for your dream job</h1>
                {isProcessing ? (
                    <>
                        <h2>{statusText}</h2>
                        <img src="/images/resume-scan.gif" className='w-full' alt="" />
                    </>
                ): (
                    <h2>Drop your resume for an ATS score and improvement tips</h2>
                )}
                {!isProcessing && (
                    <form id='upload-form' onSubmit={handleSubmit} className='flex flex-col gap-4 mt-8'>
                        <div className='form-div'>
                            <label htmlFor="company-name">Company Name</label>
                            <input type="text" id="company-name" placeholder='Company Name' name="company-name" />
                        </div>
                        <div className='form-div'>
                            <label htmlFor="job-title">Job Title</label>
                            <input type="text" id="job-title" placeholder='Job Title' name="job-title" />
                        </div>
                        <div className='form-div'>
                            <label htmlFor="job-description">Job Description</label>
                            <textarea rows={5} id="job-description" placeholder='Job Description' name="job-description" />
                        </div>
                        <div className='form-div'>
                            <label htmlFor="uploader">Upload Resume</label>
                            <FileUploader onFileSelect={handleFileSelect} />
                        </div>

                        <button className='primary-button' type='submit'>
                            Analyse Resume
                        </button>
                    </form>
                )}
            </div>
        </section>
    </main>
  )
}

export default upload