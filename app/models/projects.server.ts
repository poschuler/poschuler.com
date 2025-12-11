import { dbQuery } from "~/db.server";

export type ProjectRowType = {
  idProject: number;
  imgUrl: string;
  projectUrl: string;
  title: string;
  content: string;
};

export async function findAllProjects() {
  let queryResult = await dbQuery<ProjectRowType>(
    `select
      id_project as "idProject",
      img_url as "imgUrl",
      project_url as "projectUrl",
      title as "title",
      content as "content"      
      from projects
      order by date desc
    `,
    null
  );

  return queryResult;
}
