fetch( 'https://api.github.com/repositories/42366054' )
	.then( function( response )
	{
		if( !response.ok )
		{
			throw new Error( 'Failed to fetch github repo info' );
		}

		return response.json();
	} )
	.then( function( response )
	{
		const starsCount = document.getElementById( 'js-stars-count' );
		const formatter = new Intl.NumberFormat( 'en', { notation: 'compact' } );
		starsCount.textContent = formatter.format( response.stargazers_count );
	} );

fetch( 'https://api.github.com/repositories/42366054/releases/latest', {
	headers: {
		Accept: 'application/vnd.github.html+json',
	},
} )
	.then( function( response )
	{
		if( !response.ok )
		{
			throw new Error( 'Failed to fetch github release' );
		}

		return response.json();
	} )
	.then( function( response )
	{
		const releaseAssetsContainer = document.getElementById( 'js-release-assets' );
		releaseAssetsContainer.innerHTML = '';

		for( const asset of response.assets )
		{
			if( asset.name === 'Source2Viewer.exe' )
			{
				document.getElementById( 'js-download' ).href = asset.browser_download_url;

				const version = document.querySelector( '.download-version' );

				let string = `View release notes for v${response.tag_name}`;

				if( window.innerWidth > 500 )
				{
					const date = new Date( response.published_at );
					string += `, released on ${date.toLocaleDateString()}`;
				}

				version.textContent = string;
			}

			let name = asset.name;

			if( name.endsWith( '.zip' ) )
			{
				name = name.substring( 0, name.length - 4 ).replace( /-/g, ' ' );
			}

			const assetLink = document.createElement( 'a' );
			assetLink.href = asset.browser_download_url;
			assetLink.className = 'asset-link';
			assetLink.download = '';
			assetLink.textContent = name;
			releaseAssetsContainer.append( assetLink );
		}

		const githubLink = document.createElement( 'a' );
		githubLink.href = response.html_url;
		githubLink.className = 'asset-link';
		githubLink.target = '_blank';
		githubLink.rel = 'noopener';
		githubLink.textContent = 'View release on GitHub';
		releaseAssetsContainer.append( githubLink );

		const releaseNotesTitle = document.getElementById( 'js-release-notes-title' );
		releaseNotesTitle.textContent = `Release Notes for v${response.tag_name}`;

		const releaseNotesContainer = document.getElementById( 'js-release-notes' );
		releaseNotesContainer.innerHTML = response.body_html;

	} );

function LoadWorkshop()
{
	fetch( 'https://steamdb.info/api/Source2ViewerWorkshop/' )
		.then( function( response )
		{
			if( !response.ok )
			{
				throw new Error( 'Failed to fetch workshop items' );
			}

			return response.json();
		} )
		.then( function( response )
		{
			if( !response.success || !response.data )
			{
				throw new Error( 'Failed to fetch workshop items' );
			}

			const dateFormatter = new Intl.DateTimeFormat(undefined, {
				dateStyle: 'medium',
			});

			const dom = document.querySelectorAll( '.workshop-item' );

			for( let i = 0; i < response.data.length && i < dom.length; i++ )
			{
				const file = response.data[ i ];
				const element = dom[ i ];
				const date = new Date( file.time_created * 1000 );

				const params = new URLSearchParams();
				params.set( 'id', file.id );
				params.set( 'utm_source', 'Source 2 Viewer' );
				params.set( 'searchtext', 'valveresourceformat' );

				element.href = `https://steamcommunity.com/sharedfiles/filedetails/?${params}`;
				element.querySelector( '.workshop-image' ).src = file.preview_url;
				element.querySelector( '.workshop-title' ).textContent = file.title;
				element.querySelector( '.workshop-info' ).textContent = `${dateFormatter.format(date)} — ${file.subscriptions.toLocaleString()} subscribers`;
			}
		} );
}

if( 'IntersectionObserver' in window )
{
	const observer = new window.IntersectionObserver( entries =>
	{
		entries.forEach( entry =>
		{
			if( entry.isIntersecting )
			{
				observer.disconnect();
				LoadWorkshop();
			}
		} );
	}, {
		rootMargin: '200px 0px 0px 0px'
	} );
	observer.observe( document.querySelector( '.workshop' ) );
}
else
{
	LoadWorkshop();
}
